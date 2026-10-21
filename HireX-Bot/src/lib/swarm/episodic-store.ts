/**
 * Episodic failure memory (Build Plan.md Step 1.3, AGENTS.md §11.2).
 *
 * Retrieval must be deterministic, dependency-free and offline: no embedding
 * API, no vector database, no network. We use a signed feature-hash
 * (a "hashing trick" TF vector) at 384 dimensions, which is good enough to
 * surface the top-3 lexically related failures and is trivially auditable —
 * two calls with the same text always produce the same vector.
 *
 * JSONL stores the payload only. Vectors are recomputed on load so the file
 * stays small and readable.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { VERIFICATION_STATES } from '@/lib/swarm/lessons';

export const EMBEDDING_DIMENSIONS = 384;

export const FailureMemorySchema = z.object({
  schema_version: z.literal(1),
  lesson_id: z.string().min(1),
  phase: z.number().int().min(1).max(10),
  module: z.string().min(1),
  error_class: z.string().min(1),
  root_cause: z.string().min(1),
  prevention_rule: z.string().min(1),
  confidence: z.number().min(0).max(1),
  verification_state: z.enum(VERIFICATION_STATES),
  created_at: z.string().datetime(),
  tags: z.array(z.string()),
});

export type FailureMemory = z.infer<typeof FailureMemorySchema>;

export interface RankedMemory {
  readonly memory: FailureMemory;
  readonly score: number;
}

/* ------------------------------------------------------------------ */
/* Deterministic hashing embedding                                     */
/* ------------------------------------------------------------------ */

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const TOKEN_PATTERN = /[\p{L}\p{N}_]+/gu;

function tokenize(value: string): string[] {
  return value.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

function memoryText(memory: FailureMemory): string {
  return [
    memory.module,
    memory.error_class,
    memory.root_cause,
    memory.prevention_rule,
    memory.tags.join(' '),
  ].join(' ');
}

export function embed(text: string): Float64Array {
  const tokens = tokenize(text);
  const vector = new Float64Array(EMBEDDING_DIMENSIONS);
  if (tokens.length === 0) return vector;

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    const bigram = `${tokens[index]} ${tokens[index + 1]}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  for (const [feature, count] of counts) {
    const hash = fnv1a(feature);
    const bucket = hash % EMBEDDING_DIMENSIONS;
    const sign = (hash & 0x80000000) === 0 ? 1 : -1;
    vector[bucket] += sign * (1 + Math.log(count));
  }

  let norm = 0;
  for (let index = 0; index < vector.length; index += 1) norm += vector[index] * vector[index];
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;

  for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  return vector;
}

export function cosineSimilarity(left: ArrayLike<number>, right: ArrayLike<number>): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function rankBySimilarity(
  memories: readonly FailureMemory[],
  query: string,
  k: number,
): RankedMemory[] {
  const queryVector = embed(query);
  return memories
    .map((memory) => ({ memory, score: cosineSimilarity(queryVector, embed(memoryText(memory))) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.memory.lesson_id.localeCompare(right.memory.lesson_id);
    })
    .slice(0, Math.max(0, k));
}

/* ------------------------------------------------------------------ */
/* JSONL store                                                         */
/* ------------------------------------------------------------------ */

const appendQueues = new Map<string, Promise<unknown>>();

function withPathLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const previous = appendQueues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  appendQueues.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export class JsonlEpisodicFailureStore {
  private readonly path: string;
  private loaded: FailureMemory[] | null = null;

  constructor(path: string) {
    this.path = path;
  }

  private async load(): Promise<FailureMemory[]> {
    if (this.loaded) return this.loaded;
    try {
      const raw = await readFile(this.path, 'utf8');
      this.loaded = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => FailureMemorySchema.parse(JSON.parse(line) as unknown));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.loaded = [];
      } else {
        throw error;
      }
    }
    return this.loaded;
  }

  async add(memory: FailureMemory): Promise<void> {
    const parsed = FailureMemorySchema.parse(memory);
    await withPathLock(this.path, async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const line = `${JSON.stringify(parsed)}\n`;
      const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
      try {
        const existing = await readFile(this.path, 'utf8').catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
          throw error;
        });
        await writeFile(tempPath, `${existing}${line}`, 'utf8');
        await rename(tempPath, this.path);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      }
    });
    this.loaded = null;
  }

  async search(query: string, k = 3): Promise<RankedMemory[]> {
    return rankBySimilarity(await this.load(), query, k);
  }

  async size(): Promise<number> {
    return (await this.load()).length;
  }
}
