/**
 * Verified-rule memory (Build Plan.md Step 1.3, AGENTS.md §11.2).
 *
 * `lessons.json` is the canonical prevention-rule ledger. It is append-only:
 * a superseded rule is retained and linked via `supersedes`, never silently
 * overwritten. Writes are serialised per path and land via atomic rename so a
 * crash during append cannot corrupt the ledger.
 */

import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

export const VERIFICATION_STATES = ['verified', 'unverified', 'refuted'] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const PROVENANCE_SOURCES = [
  'sandbox_failure',
  'test_failure',
  'runtime_failure',
  'review_finding',
  'documented_contract',
] as const;

export const ProvenanceSchema = z
  .object({
    source: z.enum(PROVENANCE_SOURCES),
    agent_role: z.string().min(1),
    run_id: z.string().min(1),
    commit_sha: z.string().min(1).nullable(),
    file_paths: z.array(z.string().min(1)),
    evidence_ref: z.string().min(1),
  })
  .strict();

export const LessonSchema = z
  .object({
    schema_version: z.literal(1),
    lesson_id: z.string().regex(/^L-[A-Za-z0-9_-]+$/),
    phase: z.number().int().min(1).max(10),
    module: z.string().min(1),
    task_id: z.string().min(1).nullable(),
    root_cause: z.string().min(1),
    prevention_rule: z.string().min(1),
    confidence: z.number().min(0).max(1),
    verification_state: z.enum(VERIFICATION_STATES),
    provenance: ProvenanceSchema,
    regression_test: z.string().min(1).nullable(),
    created_at: z.string().datetime(),
    verified_at: z.string().datetime().nullable(),
    tags: z.array(z.string().min(1)),
    supersedes: z.string().min(1).nullable(),
  })
  .strict();

export type Lesson = z.infer<typeof LessonSchema>;

export const LessonsFileSchema = z
  .object({
    schema_version: z.literal(1),
    updated_at: z.string().datetime(),
    lessons: z.array(LessonSchema),
  })
  .strict();

export type LessonsFile = z.infer<typeof LessonsFileSchema>;

export type LessonStoreErrorCode =
  | 'INVALID_LESSON'
  | 'CORRUPT_LEDGER'
  | 'DUPLICATE_LESSON_ID';

export class LessonStoreError extends Error {
  readonly code: LessonStoreErrorCode;

  constructor(code: LessonStoreErrorCode, message: string) {
    super(message);
    this.name = 'LessonStoreError';
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Per-path write serialisation                                        */
/* ------------------------------------------------------------------ */

const writeQueues = new Map<string, Promise<unknown>>();

function withPathLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

function emptyLedger(): LessonsFile {
  return {
    schema_version: 1,
    updated_at: new Date(0).toISOString(),
    lessons: [],
  };
}

async function readRaw(path: string): Promise<LessonsFile> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyLedger();
    throw error;
  }

  if (raw.trim().length === 0) return emptyLedger();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new LessonStoreError('CORRUPT_LEDGER', `Lesson ledger is not valid JSON: ${path}`);
  }

  const result = LessonsFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new LessonStoreError(
      'CORRUPT_LEDGER',
      `Lesson ledger failed schema validation: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  }
  return result.data;
}

export async function readLessons(path: string): Promise<LessonsFile> {
  return readRaw(path);
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

let tempCounter = 0;

async function writeAtomic(path: string, ledger: LessonsFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  tempCounter += 1;
  const tempPath = `${path}.${process.pid}.${tempCounter}.tmp`;
  const payload = `${JSON.stringify(ledger, null, 2)}\n`;

  try {
    const handle = await open(tempPath, 'w');
    try {
      await handle.writeFile(payload, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function appendLesson(path: string, lesson: Lesson): Promise<LessonsFile> {
  return withPathLock(path, async () => {
    const parsed = LessonSchema.safeParse(lesson);
    if (!parsed.success) {
      throw new LessonStoreError(
        'INVALID_LESSON',
        `Lesson failed schema validation: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }

    const ledger = await readRaw(path);
    if (ledger.lessons.some((entry) => entry.lesson_id === parsed.data.lesson_id)) {
      throw new LessonStoreError(
        'DUPLICATE_LESSON_ID',
        `Lesson ${parsed.data.lesson_id} already exists; supersede it instead of overwriting.`,
      );
    }

    const next: LessonsFile = {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      lessons: [...ledger.lessons, parsed.data],
    };

    await writeAtomic(path, next);
    return next;
  });
}
