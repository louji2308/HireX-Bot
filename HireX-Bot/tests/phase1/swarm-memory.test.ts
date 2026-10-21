import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LessonStoreError,
  LessonsFileSchema,
  appendLesson,
  readLessons,
  type Lesson,
} from '@/lib/swarm/lessons';
import {
  JsonlEpisodicFailureStore,
  cosineSimilarity,
  embed,
  rankBySimilarity,
  type FailureMemory,
} from '@/lib/swarm/episodic-store';

const SEEDED_LESSONS = fileURLToPath(new URL('../../swarm/memory/lessons.json', import.meta.url));

const makeLesson = (id: string, overrides: Partial<Lesson> = {}): Lesson => ({
  schema_version: 1,
  lesson_id: id,
  phase: 1,
  module: 'security/untrusted-envelope',
  task_id: null,
  root_cause: 'Regex only stripped the literal closing tag.',
  prevention_rule: 'Decode entities before stripping delimiters.',
  confidence: 0.9,
  verification_state: 'verified',
  provenance: {
    source: 'sandbox_failure',
    agent_role: 'Critic-Reflexion',
    run_id: 'run-test',
    commit_sha: null,
    file_paths: ['src/lib/security/untrusted-envelope.ts'],
    evidence_ref: 'tests/bootstrap/untrusted-envelope.test.ts',
  },
  regression_test: 'tests/bootstrap/untrusted-envelope.test.ts',
  created_at: '2026-10-21T00:00:00.000Z',
  verified_at: '2026-10-21T00:00:00.000Z',
  tags: ['security', 'prompt-injection'],
  supersedes: null,
  ...overrides,
});

const makeMemory = (overrides: Partial<FailureMemory> = {}): FailureMemory => ({
  schema_version: 1,
  lesson_id: 'L-test',
  phase: 1,
  module: 'security/untrusted-envelope',
  error_class: 'assertion',
  root_cause: 'placeholder',
  prevention_rule: 'placeholder rule',
  confidence: 0.8,
  verification_state: 'verified',
  created_at: '2026-10-21T00:00:00.000Z',
  tags: [],
  ...overrides,
});

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hirexbot-memory-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('canonical lessons.json', () => {
  it('ships a schema-valid seed ledger containing lesson L-001', async () => {
    const file = await readLessons(SEEDED_LESSONS);
    expect(LessonsFileSchema.safeParse(file).success).toBe(true);
    const lesson = file.lessons.find((entry) => entry.lesson_id === 'L-001');
    expect(lesson).toBeDefined();
    expect(lesson?.verification_state).toBe('verified');
    expect(lesson?.provenance.evidence_ref.length).toBeGreaterThan(0);
    expect(lesson?.prevention_rule).toMatch(/decode/i);
  });

  it('appends a lesson and persists it atomically', async () => {
    const path = join(dir, 'lessons.json');
    await readLessons(path);
    await appendLesson(path, makeLesson('L-002'));

    const reloaded = await readLessons(path);
    expect(reloaded.lessons.map((lesson) => lesson.lesson_id)).toEqual(['L-002']);
    expect(await readdir(dir)).toEqual(['lessons.json']);
  });

  it('rejects a duplicate lesson id instead of silently overwriting history', async () => {
    const path = join(dir, 'lessons.json');
    await appendLesson(path, makeLesson('L-001'));
    await expect(appendLesson(path, makeLesson('L-001'))).rejects.toBeInstanceOf(LessonStoreError);
    const reloaded = await readLessons(path);
    expect(reloaded.lessons).toHaveLength(1);
  });

  it('rejects a schema-invalid lesson', async () => {
    const path = join(dir, 'lessons.json');
    const invalid = { ...makeLesson('L-003'), confidence: 2 };
    await expect(appendLesson(path, invalid as unknown as Lesson)).rejects.toBeInstanceOf(
      LessonStoreError,
    );
  });

  it('serialises concurrent appends without losing a write', async () => {
    const path = join(dir, 'lessons.json');
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => appendLesson(path, makeLesson(`L-${100 + index}`))),
    );
    const reloaded = await readLessons(path);
    expect(reloaded.lessons).toHaveLength(12);
    expect(new Set(reloaded.lessons.map((lesson) => lesson.lesson_id)).size).toBe(12);
    const raw = await readFile(path, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('never leaves a temporary file behind', async () => {
    const path = join(dir, 'lessons.json');
    await appendLesson(path, makeLesson('L-004'));
    const entries = await readdir(dir);
    expect(entries.some((entry) => entry.includes('.tmp'))).toBe(false);
  });
});

describe('episodic failure memory', () => {
  it('produces a deterministic 384-dimension unit vector', () => {
    const first = embed('Supabase RLS blocked the webhook write');
    const second = embed('Supabase RLS blocked the webhook write');
    expect(first).toHaveLength(384);
    expect(Array.from(first)).toEqual(Array.from(second));
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it('scores identical text as fully similar and unrelated text lower', () => {
    const a = embed('RLS blocked webhook write');
    expect(cosineSimilarity(a, embed('RLS blocked webhook write'))).toBeCloseTo(1, 6);
    expect(cosineSimilarity(a, embed('quantum chromodynamics'))).toBeLessThan(0.5);
  });

  it('ranks the semantically closest lesson first', () => {
    const memories = [
      makeMemory({
        lesson_id: 'L-params',
        module: 'nextjs/app-router',
        root_cause: 'Next.js 15 params are asynchronous and were read synchronously.',
        prevention_rule: 'Await params in dynamic route handlers.',
      }),
      makeMemory({
        lesson_id: 'L-rls',
        module: 'supabase/rls',
        root_cause: 'Supabase RLS blocked service-role webhook writes.',
        prevention_rule: 'Use the service-role client for webhook writes and test RLS explicitly.',
      }),
      makeMemory({
        lesson_id: 'L-css',
        module: 'design/tokens',
        root_cause: 'Tailwind v4 ignored the v3 config file.',
        prevention_rule: 'Pin Tailwind 3.4 when the design contract is a tailwind.config.ts.',
      }),
    ];

    const ranked = rankBySimilarity(memories, 'RLS blocked webhook write', 3);
    expect(ranked[0]?.memory.lesson_id).toBe('L-rls');
    expect(ranked.map((entry) => entry.score)).toEqual(
      [...ranked.map((entry) => entry.score)].sort((a, b) => b - a),
    );
  });

  it('returns at most k results and is deterministic across repeated queries', () => {
    const memories = Array.from({ length: 8 }, (_, index) =>
      makeMemory({ lesson_id: `L-${index}`, prevention_rule: `rule ${index}` }),
    );
    const first = rankBySimilarity(memories, 'rule 3', 3);
    const second = rankBySimilarity(memories, 'rule 3', 3);
    expect(first).toHaveLength(3);
    expect(first.map((entry) => entry.memory.lesson_id)).toEqual(
      second.map((entry) => entry.memory.lesson_id),
    );
  });

  it('persists payloads without persisting vectors', async () => {
    const path = join(dir, 'failure_memories.jsonl');
    const store = new JsonlEpisodicFailureStore(path);
    await store.add(
      makeMemory({
        lesson_id: 'L-rls',
        root_cause: 'Supabase RLS blocked service-role webhook writes.',
        prevention_rule: 'Use the service-role client for webhook writes.',
      }),
    );
    expect(await store.size()).toBe(1);

    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
    expect(parsed.lesson_id).toBe('L-rls');
    expect(Object.keys(parsed)).not.toContain('vector');
    expect(raw.length).toBeLessThan(4000);
  });

  it('reloads from disk and retrieves the same top result', async () => {
    const path = join(dir, 'failure_memories.jsonl');
    const store = new JsonlEpisodicFailureStore(path);
    await store.add(makeMemory({ lesson_id: 'L-rls', prevention_rule: 'test RLS writes' }));
    await store.add(makeMemory({ lesson_id: 'L-css', prevention_rule: 'pin tailwind version' }));

    const reloaded = new JsonlEpisodicFailureStore(path);
    const results = await reloaded.search('RLS writes', 3);
    expect(results[0]?.memory.lesson_id).toBe('L-rls');
  });
});
