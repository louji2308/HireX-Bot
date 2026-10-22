/**
 * Phase 2 consolidated experience memory (Build Plan Step 2.4, Architecture A7).
 *
 * `swarm/memory/memory.jsonl` stores only evidence-derived facts. No raw
 * candidate text, resume content or model prose is written here: each
 * provenance entry carries the SHA-256 of the source response so a fact can be
 * audited back to the immutable database row without duplicating personal data.
 *
 * The production path is `llm-consolidator.ts` (SMART-Code). The function below
 * is the offline deterministic baseline and is also used by unit tests.
 *
 * Consolidation is a pure function of supplied rows. It never infers a missing
 * score, never averages across rubric versions and never describes a candidate
 * in deficit language. Re-running it on the same evidence produces byte-identical
 * records, which is what makes the JSONL append idempotent.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

export const MEMORY_SCHEMA_VERSION = 1;
export const MEMORY_RECORD_KINDS = ['consolidated_fact', 'erasure_tombstone'] as const;

export const MEMORY_FACT_TYPES = [
  'demonstrated_strength',
  'recurring_gap',
  'hint_dependency',
  'independent_evidence',
] as const;
export type MemoryFactType = (typeof MEMORY_FACT_TYPES)[number];

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const FACT_ID_PATTERN = /^mf_[0-9a-f]{24}$/;

export const ProvenanceEntrySchema = z
  .object({
    session_response_id: z.string().uuid(),
    content_sha256: z.string().regex(SHA256_PATTERN),
    stored_at: z.string().datetime(),
  })
  .strict();

export const ConsolidatedFactSchema = z
  .object({
    schema_version: z.literal(MEMORY_SCHEMA_VERSION),
    record_kind: z.literal('consolidated_fact'),
    fact_id: z.string().regex(FACT_ID_PATTERN),
    idempotency_key: z.string().regex(SHA256_PATTERN),
    candidate_ref: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    session_id: z.string().uuid(),
    rubric_version_id: z.string().min(1),
    round_type: z.string().min(1),
    fact_type: z.enum(MEMORY_FACT_TYPES),
    topic_or_criterion: z.string().min(1).max(120),
    statement: z.string().min(1).max(400),
    score_five_scale: z.number().min(0).max(5),
    source_session_response_ids: z.array(z.string().uuid()).min(1),
    provenance: z.array(ProvenanceEntrySchema).min(1),
    confidence: z.number().min(0).max(1),
    verification_state: z.enum(['verified', 'unverified']),
    method: z.enum(['deterministic', 'llm']),
    created_at: z.string().datetime(),
    status: z.enum(['active', 'superseded']),
  })
  .strict();

export const ErasureTombstoneSchema = z
  .object({
    schema_version: z.literal(MEMORY_SCHEMA_VERSION),
    record_kind: z.literal('erasure_tombstone'),
    candidate_ref: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    erased_fact_count: z.number().int().min(0),
    erased_at: z.string().datetime(),
  })
  .strict();

export const MemoryRecordSchema = z.discriminatedUnion('record_kind', [
  ConsolidatedFactSchema,
  ErasureTombstoneSchema,
]);

export type ConsolidatedFact = z.infer<typeof ConsolidatedFactSchema>;
export type ErasureTombstone = z.infer<typeof ErasureTombstoneSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

/* ------------------------------------------------------------------ */
/* Reference derivation                                                */
/* ------------------------------------------------------------------ */

export function candidateReference(candidateId: string): string {
  return `sha256:${createHash('sha256').update(`hirex-candidate-v1:${candidateId}`, 'utf8').digest('hex')}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/* ------------------------------------------------------------------ */
/* Deterministic consolidation                                         */
/* ------------------------------------------------------------------ */

export interface ResponseEvidence {
  readonly sessionResponseId: string;
  readonly topicTags: readonly string[];
  readonly criterionScores: Readonly<Record<string, number>>;
  readonly hintsUsedCount: number;
  readonly independentFirstAttempt: boolean;
  readonly evidenceFeedbackMd: string;
  readonly storedAt: string;
}

export interface ConsolidationInput {
  readonly candidateId: string;
  readonly sessionId: string;
  readonly rubricVersionId: string;
  readonly roundType: string;
  readonly responses: readonly ResponseEvidence[];
  readonly createdAt?: string;
}

export interface ConsolidationResult {
  readonly records: readonly ConsolidatedFact[];
  readonly skipped: readonly { sessionResponseId: string; reason: string }[];
}

const SAFE_LABEL = /^[A-Za-z][A-Za-z0-9 _-]{0,59}$/;
const SAFE_CRITERION = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const KNOWN_ROUND_TYPES = new Set([
  'Resume_Screen',
  'Online_Assessment',
  'Recruiter_Screen',
  'Coding',
  'Technical_Fundamentals',
  'Project_Discussion',
  'Role_Specific_Practical',
  'System_Design',
  'Behavioral',
  'Final_HR_Offer',
]);

/**
 * Criterion names and round labels are untrusted input: they arrive from stored
 * responses and are later embedded in memory statements that prompts may read.
 * Strip any envelope or instruction-shaped content and accept only a narrow
 * label grammar; anything else is skipped rather than silently quoted.
 */
function sanitizeLabel(value: string, pattern: RegExp = SAFE_LABEL): string | null {
  const stripped = value
    .replace(/<\/?untrusted-data[^>]*>/gi, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!pattern.test(stripped)) return null;
  return stripped;
}

/** Criterion keys are untrusted; only a narrow snake_case grammar is retained. */
export function sanitizeCriterionLabel(value: string): string | null {
  return sanitizeLabel(value, SAFE_CRITERION);
}

/** Unknown round labels are not trusted as memory context. */
export function normalizeRoundType(value: string): string {
  return KNOWN_ROUND_TYPES.has(value) ? value : 'assessment';
}

function classify(score: number, hintsUsed: number): MemoryFactType {
  if (hintsUsed > 0) return 'hint_dependency';
  if (score < 3) return 'recurring_gap';
  if (score >= 4) return 'demonstrated_strength';
  return 'independent_evidence';
}

function statementFor(
  factType: MemoryFactType,
  criterion: string,
  score: number,
  hintsUsed: number,
  roundType: string,
): string {
  const rounded = score.toFixed(1);
  const context = `${roundType.replace(/_/g, ' ').toLowerCase()} round`;
  switch (factType) {
    case 'demonstrated_strength':
      return `Unaided, independent evidence at ${rounded}/5 for ${criterion} in the ${context}.`;
    case 'recurring_gap':
      return `Scored ${rounded}/5 for ${criterion} in the ${context}; a focused retake is the next step.`;
    case 'hint_dependency':
      return `Used ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} for ${criterion} at ${rounded}/5 in the ${context}; an unaided retake would confirm independence.`;
    default:
      return `Observed ${rounded}/5 for ${criterion} with no hints recorded in the ${context}.`;
  }
}

function confidenceFor(factType: MemoryFactType, independent: boolean): number {
  if (factType === 'demonstrated_strength') return independent ? 0.9 : 0.7;
  if (factType === 'recurring_gap') return 0.8;
  if (factType === 'hint_dependency') return 0.85;
  return 0.6;
}

export function consolidateSession(input: ConsolidationInput): ConsolidationResult {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const candidateRef = candidateReference(input.candidateId);
  const roundType = normalizeRoundType(input.roundType);
  const records: ConsolidatedFact[] = [];
  const skipped: { sessionResponseId: string; reason: string }[] = [];

  for (const response of input.responses) {
    const criteria = Object.entries(response.criterionScores);
    if (criteria.length === 0) {
      skipped.push({ sessionResponseId: response.sessionResponseId, reason: 'no_criterion_scores' });
      continue;
    }

    const contentSha = sha256(response.evidenceFeedbackMd);
    const provenance = [
      {
        session_response_id: response.sessionResponseId,
        content_sha256: contentSha,
        stored_at: response.storedAt,
      },
    ];

    for (const [rawCriterion, score] of criteria) {
      if (!Number.isFinite(score) || score < 0 || score > 5) {
        skipped.push({
          sessionResponseId: response.sessionResponseId,
          reason: `invalid_score:${rawCriterion.slice(0, 60)}`,
        });
        continue;
      }

      const criterion = sanitizeCriterionLabel(rawCriterion);
      if (!criterion) {
        skipped.push({
          sessionResponseId: response.sessionResponseId,
          reason: 'unsafe_criterion',
        });
        continue;
      }

      const factType = classify(score, response.hintsUsedCount);
      const independent = response.independentFirstAttempt && response.hintsUsedCount === 0;
      const idempotencyKey = sha256(
        JSON.stringify({
          candidate: candidateRef,
          session: input.sessionId,
          rubric: input.rubricVersionId,
          criterion,
          factType,
          score,
          response: response.sessionResponseId,
        }),
      );

      records.push({
        schema_version: MEMORY_SCHEMA_VERSION,
        record_kind: 'consolidated_fact',
        fact_id: `mf_${idempotencyKey.slice(0, 24)}`,
        idempotency_key: idempotencyKey,
        candidate_ref: candidateRef,
        session_id: input.sessionId,
        rubric_version_id: input.rubricVersionId,
        round_type: roundType,
        fact_type: factType,
        topic_or_criterion: criterion,
        statement: statementFor(factType, criterion, score, response.hintsUsedCount, roundType),
        score_five_scale: score,
        source_session_response_ids: [response.sessionResponseId],
        provenance,
        confidence: confidenceFor(factType, independent),
        verification_state: 'verified',
        method: 'deterministic',
        created_at: createdAt,
        status: 'active',
      });
    }
  }

  records.sort((left, right) => left.fact_id.localeCompare(right.fact_id));
  return { records, skipped };
}

/* ------------------------------------------------------------------ */
/* JSONL store                                                         */
/* ------------------------------------------------------------------ */

const pathLocks = new Map<string, Promise<unknown>>();

function withPathLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const previous = pathLocks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  pathLocks.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

async function readRecords(path: string): Promise<MemoryRecord[]> {
  const raw = await readFile(path, 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  });
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => MemoryRecordSchema.parse(JSON.parse(line) as unknown));
}

async function writeRecords(path: string, records: readonly MemoryRecord[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const payload = records.map((record) => JSON.stringify(record)).join('\n');
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tempPath, payload.length > 0 ? `${payload}\n` : '', 'utf8');
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export interface AppendOutcome {
  readonly appended: number;
  readonly duplicates: number;
}

export class ErasureTombstoneError extends Error {
  readonly candidateRefs: readonly string[];

  constructor(candidateRefs: readonly string[]) {
    super('Cannot append memory facts for an erased candidate.');
    this.name = 'ErasureTombstoneError';
    this.candidateRefs = candidateRefs;
  }
}

export class JsonlMemoryStore {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async append(records: readonly ConsolidatedFact[]): Promise<AppendOutcome> {
    const parsed = records.map((record) => ConsolidatedFactSchema.parse(record));
    return withPathLock(this.path, async () => {
      const existing = await readRecords(this.path);
      const tombstoned = new Set(
        existing
          .filter(
            (record): record is ErasureTombstone => record.record_kind === 'erasure_tombstone',
          )
          .map((record) => record.candidate_ref),
      );
      const blocked = [...new Set(parsed.map((record) => record.candidate_ref))].filter((ref) =>
        tombstoned.has(ref),
      );
      if (blocked.length > 0) throw new ErasureTombstoneError(blocked);

      const seen = new Set(
        existing
          .filter((record): record is ConsolidatedFact => record.record_kind === 'consolidated_fact')
          .map((record) => record.idempotency_key),
      );
      const fresh = parsed.filter((record) => {
        if (seen.has(record.idempotency_key)) return false;
        seen.add(record.idempotency_key);
        return true;
      });
      if (fresh.length > 0) {
        await writeRecords(this.path, [...existing, ...fresh]);
      }
      return { appended: fresh.length, duplicates: parsed.length - fresh.length };
    });
  }

  async read(candidateId?: string): Promise<MemoryRecord[]> {
    const records = await readRecords(this.path);
    if (!candidateId) return records;
    const reference = candidateReference(candidateId);
    return records.filter((record) => record.candidate_ref === reference);
  }

  async facts(candidateId: string): Promise<ConsolidatedFact[]> {
    return (await this.read(candidateId)).filter(
      (record): record is ConsolidatedFact => record.record_kind === 'consolidated_fact',
    );
  }

  async eraseCandidate(
    candidateId: string,
    erasedAt = new Date().toISOString(),
  ): Promise<{ removed: number; tombstone: ErasureTombstone }> {
    const reference = candidateReference(candidateId);
    return withPathLock(this.path, async () => {
      const existing = await readRecords(this.path);
      const priorTombstone = existing.find(
        (record): record is ErasureTombstone =>
          record.record_kind === 'erasure_tombstone' && record.candidate_ref === reference,
      );
      const removedFacts = existing.filter(
        (record) => record.record_kind === 'consolidated_fact' && record.candidate_ref === reference,
      ).length;
      const retained = existing.filter(
        (record) =>
          record.candidate_ref !== reference || record.record_kind === 'erasure_tombstone',
      );
      const tombstone: ErasureTombstone =
        priorTombstone ?? {
          schema_version: MEMORY_SCHEMA_VERSION,
          record_kind: 'erasure_tombstone',
          candidate_ref: reference,
          erased_fact_count: removedFacts,
          erased_at: erasedAt,
        };

      // Repeated erasure must not create a second tombstone or inflate counts.
      if (!priorTombstone || removedFacts > 0) {
        await writeRecords(this.path, [...retained, tombstone]);
      }
      return { removed: removedFacts, tombstone };
    });
  }
}
