import { describe, expect, it } from 'vitest';
import {
  purgeCandidateStorage,
  storageBucketsFromEnvironment,
  type StorageClientLike,
} from '@/lib/supabase/storage';
import {
  readVaultEntries,
  revokeOAuthGrants,
  type FetchLike,
} from '@/lib/supabase/token-revocation';
import { TokenVault } from '@/lib/supabase/vault';

const CANDIDATE = '11111111-1111-4111-8111-111111111111';
const KEY = Buffer.alloc(32, 7).toString('base64');
const vault = new TokenVault({ test: KEY }, 'test');

function sealedFor(provider: string, purpose = 'oauth') {
  return vault.seal(`${provider}-token`, { candidateId: CANDIDATE, provider, purpose });
}

function fetchSpy(status = 200): { impl: FetchLike; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  return {
    calls,
    impl: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status });
    },
  };
}

describe('phase 2 — OAuth revocation', () => {
  it('reads only well-formed sealed entries', () => {
    const entries = readVaultEntries({
      google: sealedFor('google'),
      github: { not: 'sealed' },
      junk: 7,
    });
    expect(entries.map((entry) => entry.provider)).toEqual(['google']);
  });

  it('revokes a Google grant with the documented endpoint', async () => {
    const spy = fetchSpy(200);
    const outcome = await revokeOAuthGrants(
      CANDIDATE,
      { google: sealedFor('google') },
      { vault, fetchImpl: spy.impl },
    );

    expect(outcome).toEqual({ revoked: 1, failed: 0, ok: true });
    expect(spy.calls[0].url).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(spy.calls[0].init?.body)).toContain('token=google-token');
  });

  it('counts a GitHub revocation as failed when app credentials are absent', async () => {
    const spy = fetchSpy(204);
    const outcome = await revokeOAuthGrants(
      CANDIDATE,
      { github: sealedFor('github') },
      { vault, fetchImpl: spy.impl },
    );

    expect(outcome).toEqual({ revoked: 0, failed: 1, ok: false });
    expect(spy.calls).toHaveLength(0);
  });

  it('revokes a GitHub grant when app credentials are configured', async () => {
    const spy = fetchSpy(204);
    const outcome = await revokeOAuthGrants(
      CANDIDATE,
      { github: sealedFor('github') },
      {
        vault,
        githubClientId: 'client-id',
        githubClientSecret: 'client-secret',
        fetchImpl: spy.impl,
      },
    );

    expect(outcome).toEqual({ revoked: 1, failed: 0, ok: true });
    expect(spy.calls[0].init?.method).toBe('DELETE');
  });

  it('fails closed on ciphertext bound to another candidate', async () => {
    const otherBinding = vault.seal('token', {
      candidateId: '22222222-2222-4222-8222-222222222222',
      provider: 'google',
      purpose: 'oauth',
    });
    const outcome = await revokeOAuthGrants(CANDIDATE, { google: otherBinding }, { vault });

    expect(outcome).toEqual({ revoked: 0, failed: 1, ok: false });
  });

  it('treats an empty vault as fully revoked', async () => {
    const outcome = await revokeOAuthGrants(CANDIDATE, {}, { vault });
    expect(outcome).toEqual({ revoked: 0, failed: 0, ok: true });
  });
});

describe('phase 2 — storage purge', () => {
  function storageClient(
    listings: Record<string, { names: string[]; error?: string }>,
  ): { client: StorageClientLike; removed: Array<{ bucket: string; paths: string[] }> } {
    const removed: Array<{ bucket: string; paths: string[] }> = [];
    const client: StorageClientLike = {
      storage: {
        from(bucket) {
          return {
            async list() {
              const entry = listings[bucket] ?? { names: [] };
              if (entry.error) return { data: null, error: { message: entry.error } };
              return { data: entry.names.map((name) => ({ name })), error: null };
            },
            async remove(paths) {
              removed.push({ bucket, paths });
              return { data: null, error: null };
            },
          };
        },
      },
    };
    return { client, removed };
  }

  it('removes every object under the candidate prefix in each bucket', async () => {
    const { client, removed } = storageClient({
      resumes: { names: ['cv.pdf'] },
      'tailored-resumes': { names: ['acme.pdf', 'beta.pdf'] },
    });

    const outcome = await purgeCandidateStorage(client, CANDIDATE, [
      'resumes',
      'tailored-resumes',
    ]);

    expect(outcome).toEqual({ removed: 3, ok: true });
    expect(removed[0]).toEqual({ bucket: 'resumes', paths: [`${CANDIDATE}/cv.pdf`] });
  });

  it('treats a missing bucket as already erased', async () => {
    const { client } = storageClient({
      resumes: { names: [], error: 'Bucket not found' },
    });

    expect(await purgeCandidateStorage(client, CANDIDATE, ['resumes'])).toEqual({
      removed: 0,
      ok: true,
    });
  });

  it('reports incomplete for a real storage error', async () => {
    const { client } = storageClient({
      resumes: { names: [], error: 'permission denied' },
    });

    expect(await purgeCandidateStorage(client, CANDIDATE, ['resumes'])).toEqual({
      removed: 0,
      ok: false,
    });
  });

  it('parses the bucket allowlist from the environment', () => {
    expect(storageBucketsFromEnvironment({ HIREX_STORAGE_BUCKETS: 'a, b ,' })).toEqual(['a', 'b']);
    expect(storageBucketsFromEnvironment({})).toEqual(['resumes', 'tailored-resumes']);
  });
});
