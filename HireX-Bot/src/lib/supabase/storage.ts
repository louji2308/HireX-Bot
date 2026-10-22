/**
 * Storage objects belonging to a candidate must be erased with the database row.
 *
 * Resumes, tailored PDFs and replay artefacts live under `<candidateId>/...` in
 * Supabase Storage. Deleting only the row would leave PII downloadable by URL.
 * The client is injected so the purge can be tested without network access.
 */

export interface StorageBucketClient {
  list(
    path: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Array<{ name: string }> | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface StorageClientLike {
  storage: { from(bucket: string): StorageBucketClient };
}

export interface StoragePurgeOutcome {
  readonly removed: number;
  readonly ok: boolean;
}

export const DEFAULT_STORAGE_BUCKETS = ['resumes', 'tailored-resumes'] as const;

export function storageBucketsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const raw = environment.HIREX_STORAGE_BUCKETS;
  if (!raw || raw.trim().length === 0) return [...DEFAULT_STORAGE_BUCKETS];
  return raw
    .split(',')
    .map((bucket) => bucket.trim())
    .filter((bucket) => bucket.length > 0);
}

function bucketMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('bucket not found') || lower.includes('not found');
}

/**
 * Removes every object directly under the candidate's prefix in each bucket.
 * A missing bucket is treated as already-erased; any other storage error makes
 * the purge incomplete so the receipt reports `partial` instead of `completed`.
 */
export async function purgeCandidateStorage(
  client: StorageClientLike,
  candidateId: string,
  buckets: readonly string[] = DEFAULT_STORAGE_BUCKETS,
): Promise<StoragePurgeOutcome> {
  let removed = 0;
  let ok = true;

  for (const bucket of buckets) {
    const bucketClient = client.storage.from(bucket);
    let names: string[] = [];

    try {
      const { data, error } = await bucketClient.list(candidateId, { limit: 1000, offset: 0 });
      if (error) {
        if (!bucketMissing(error.message)) ok = false;
        continue;
      }
      names = (data ?? []).map((entry) => entry.name);
    } catch {
      ok = false;
      continue;
    }

    if (names.length === 0) continue;

    const paths = names.map((name) => `${candidateId}/${name}`);
    try {
      const { error } = await bucketClient.remove(paths);
      if (error) {
        ok = false;
        continue;
      }
      removed += paths.length;
    } catch {
      ok = false;
    }
  }

  return { removed, ok };
}
