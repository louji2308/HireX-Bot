import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * PII-free erasure receipts (DPDP Rule 3 accountability).
 *
 * A receipt proves that an erasure request was executed without retaining the
 * data it erased. It deliberately contains only a deterministic candidate
 * reference and aggregate row counts.
 */

export const ErasureReceiptSchema = z
  .object({
    schema_version: z.literal(1),
    receipt_id: z.string().regex(/^[0-9a-f]{32}$/),
    candidate_ref: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    erased_at: z.string().datetime(),
    status: z.enum(['completed', 'partial']),
    database: z.object({
      erased: z.boolean(),
      counts: z.record(z.number().int().min(0)),
    }),
    memory: z.object({
      removed: z.number().int().min(0),
      ok: z.boolean(),
    }),
    oauth: z
      .object({
        revoked: z.number().int().min(0),
        failed: z.number().int().min(0),
        ok: z.boolean(),
      })
      .default({ revoked: 0, failed: 0, ok: true }),
    storage: z
      .object({
        removed: z.number().int().min(0),
        ok: z.boolean(),
      })
      .default({ removed: 0, ok: true }),
    identity: z
      .object({
        deleted: z.boolean(),
        ok: z.boolean(),
      })
      .default({ deleted: true, ok: true }),
  })
  .strict();

export type ErasureReceipt = z.infer<typeof ErasureReceiptSchema>;

export function erasureReceiptId(candidateId: string): string {
  return createHash('sha256')
    .update(`hirex-erasure-v1:${candidateId}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
}

export function erasureCandidateRef(candidateId: string): string {
  return `sha256:${createHash('sha256')
    .update(`hirex-candidate-v1:${candidateId}`, 'utf8')
    .digest('hex')}`;
}

const receiptLocks = new Map<string, Promise<unknown>>();

function withPathLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const previous = receiptLocks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  receiptLocks.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export class JsonlErasureReceiptStore {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async append(receipt: ErasureReceipt): Promise<{ appended: boolean }> {
    const parsed = ErasureReceiptSchema.parse(receipt);
    return withPathLock(this.path, async () => {
      const existing = await readFile(this.path, 'utf8').catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
      });
      const alreadyCompleted = existing
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .some((line) => {
          try {
            const record = JSON.parse(line) as { receipt_id?: string; status?: string };
            return record.receipt_id === parsed.receipt_id && record.status === 'completed';
          } catch {
            return false;
          }
        });

      // A completed erasure is terminal. A partial attempt may be followed by a
      // successful retry, which appends the same receipt_id with status
      // "completed"; readers must use the last record per receipt_id.
      if (alreadyCompleted) return { appended: false };

      await mkdir(dirname(this.path), { recursive: true });
      const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
      try {
        await writeFile(tempPath, `${existing}${JSON.stringify(parsed)}\n`, 'utf8');
        await rename(tempPath, this.path);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      }
      return { appended: true };
    });
  }
}
