/**
 * DPO trajectory log (Build Plan.md Step 1.5.4).
 *
 * The log records decisions, not transcripts of private content. Every entry is
 * redacted before it is written, and `training_eligible` stays false until a
 * real training run exists â€” a Phase 1 decision log is not a dataset and this
 * module never claims otherwise.
 */

import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

export const TRAJECTORY_SCHEMA_VERSION = 1;
export const DEFAULT_TRAJECTORY_PATH = 'trajectories/phase_01_dpo.jsonl';

export const TrajectoryRecordSchema = z.object({
  schema_version: z.literal(1).default(1),
  record_kind: z.literal('preference_pair'),
  phase: z.number().int().min(1).max(10),
  topic: z.string().min(1),
  chosen: z.string().min(1),
  rejected: z.string().min(1),
  rejection_reason: z.string().min(1),
  evidence: z.string().min(1),
  training_eligible: z.boolean(),
  reason_not_eligible: z.string().nullable(),
  verification_state: z.enum(['verified', 'unverified', 'refuted']),
  pair_id: z.string().min(1),
  redactions: z.number().int().min(0),
  created_at: z.string().min(1),
});

export type TrajectoryRecord = z.infer<typeof TrajectoryRecordSchema>;

export interface TrajectoryDraft {
  readonly phase: number;
  readonly topic: string;
  readonly chosen: string;
  readonly rejected: string;
  readonly rejectionReason: string;
  readonly evidence: string;
  readonly verificationState?: TrajectoryRecord['verification_state'];
}

const REDACTIONS: ReadonlyArray<{ readonly pattern: RegExp; readonly replacement: string }> = [
  { pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: '[redacted-api-key]' },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, replacement: '[redacted-github-token]' },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: '[redacted-jwt]' },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi, replacement: 'Bearer [redacted]' },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g, replacement: '[redacted-email]' },
  { pattern: /\+91[-\s]?\d{5}[-\s]?\d{5}\b/g, replacement: '[redacted-phone]' },
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[redacted-account-number]' },
];

export interface RedactionResult {
  readonly text: string;
  readonly redactions: number;
}

export function redactForTrajectory(text: string): RedactionResult {
  let redactions = 0;
  let output = text;
  for (const { pattern, replacement } of REDACTIONS) {
    output = output.replace(pattern, () => {
      redactions += 1;
      return replacement;
    });
  }
  return { text: output, redactions };
}

function pairIdFor(draft: TrajectoryDraft): string {
  return createHash('sha256')
    .update(`${draft.phase}|${draft.topic}|${draft.chosen}|${draft.rejected}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

export function buildTrajectoryRecord(
  draft: TrajectoryDraft,
  now: () => Date = () => new Date(),
): TrajectoryRecord {
  const fields = [
    draft.topic,
    draft.chosen,
    draft.rejected,
    draft.rejectionReason,
    draft.evidence,
  ] as const;

  let redactions = 0;
  const [topic, chosen, rejected, rejectionReason, evidence] = fields.map((value) => {
    const result = redactForTrajectory(value);
    redactions += result.redactions;
    return result.text;
  });

  const verificationState = draft.verificationState ?? 'verified';

  return TrajectoryRecordSchema.parse({
    schema_version: TRAJECTORY_SCHEMA_VERSION,
    record_kind: 'preference_pair',
    phase: draft.phase,
    topic,
    chosen,
    rejected,
    rejection_reason: rejectionReason,
    evidence,
    training_eligible: false,
    reason_not_eligible:
      verificationState === 'verified'
        ? 'Phase decision log only. No model training, fine-tuning or preference optimisation was performed.'
        : 'Unverified decision log. Not eligible for any training use.',
    verification_state: verificationState,
    pair_id: pairIdFor(draft),
    redactions,
    created_at: now().toISOString(),
  });
}

export async function appendTrajectory(
  draft: TrajectoryDraft,
  options: { readonly path?: string; readonly now?: () => Date } = {},
): Promise<TrajectoryRecord> {
  const record = buildTrajectoryRecord(draft, options.now);
  const path = options.path ?? DEFAULT_TRAJECTORY_PATH;
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}
