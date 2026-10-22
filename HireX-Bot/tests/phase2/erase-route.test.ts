import { describe, expect, it } from 'vitest';
import {
  createEraseHandler,
  type EraseDependencies,
} from '@/lib/supabase/erase-handler';
import {
  ErasureReceiptSchema,
  erasureCandidateRef,
  erasureReceiptId,
  type ErasureReceipt,
} from '@/lib/memory/erasure-receipts';

const CANDIDATE = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'valid-access-token';

interface Harness {
  readonly deps: EraseDependencies;
  readonly receipts: ErasureReceipt[];
  readonly calls: string[];
}

function harness(overrides: Partial<EraseDependencies> = {}): Harness {
  const receipts: ErasureReceipt[] = [];
  const calls: string[] = [];

  const deps: EraseDependencies = {
    configured: () => true,
    async authenticate(token) {
      calls.push(`authenticate:${token}`);
      return token === TOKEN ? { candidateId: CANDIDATE } : null;
    },
    async revokeOAuth(candidateId) {
      calls.push(`revokeOAuth:${candidateId}`);
      return { revoked: 1, failed: 0 };
    },
    async eraseDatabase(candidateId) {
      calls.push(`eraseDatabase:${candidateId}`);
      return { erased: true, counts: { practice_sessions: 4, candidate_profiles: 1 } };
    },
    async eraseMemory(candidateId) {
      calls.push(`eraseMemory:${candidateId}`);
      return { removed: 7 };
    },
    async purgeStorage(candidateId) {
      calls.push(`purgeStorage:${candidateId}`);
      return { removed: 3 };
    },
    async deleteIdentity(candidateId) {
      calls.push(`deleteIdentity:${candidateId}`);
      return { deleted: true };
    },
    async appendReceipt(receipt) {
      calls.push('appendReceipt');
      receipts.push(receipt);
    },
    now: () => new Date('2026-10-20T00:00:00.000Z'),
    ...overrides,
  };

  return { deps, receipts, calls };
}

function eraseRequest(token?: string): Request {
  return new Request('http://localhost/api/candidate/erase', {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('phase 2 — DPDP erase route', () => {
  it('requires a bearer token', async () => {
    const { deps, calls } = harness();
    const response = await createEraseHandler(deps)(eraseRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(calls).toEqual([]);
  });

  it('reports an unconfigured backend without attempting erasure', async () => {
    const { deps, calls } = harness({ configured: () => false });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('rejects an invalid session', async () => {
    const { deps } = harness();
    const response = await createEraseHandler(deps)(eraseRequest('expired'));

    expect(response.status).toBe(401);
  });

  it('erases database and memory, then records a PII-free receipt', async () => {
    const { deps, receipts } = harness();
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('erased');
    expect(body.memory_records_removed).toBe(7);
    expect(body.receipt_id).toBe(erasureReceiptId(CANDIDATE));
    expect(JSON.stringify(body)).not.toContain(CANDIDATE);

    expect(receipts).toHaveLength(1);
    const receipt = ErasureReceiptSchema.parse(receipts[0]);
    expect(receipt.status).toBe('completed');
    expect(receipt.candidate_ref).toBe(erasureCandidateRef(CANDIDATE));
    expect(JSON.stringify(receipt)).not.toContain(CANDIDATE);
    expect(receipt.erased_at).toBe('2026-10-20T00:00:00.000Z');
  });

  it('makes repeated requests idempotent at the receipt level', async () => {
    const { deps, receipts } = harness();
    const handler = createEraseHandler(deps);

    await handler(eraseRequest(TOKEN));
    await handler(eraseRequest(TOKEN));

    expect(receipts).toHaveLength(2);
    expect(receipts[0].receipt_id).toBe(receipts[1].receipt_id);
  });

  it('runs every erasure stage in dependency order', async () => {
    const { deps, calls } = harness();
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      `authenticate:${TOKEN}`,
      `revokeOAuth:${CANDIDATE}`,
      `eraseDatabase:${CANDIDATE}`,
      `eraseMemory:${CANDIDATE}`,
      `purgeStorage:${CANDIDATE}`,
      `deleteIdentity:${CANDIDATE}`,
      'appendReceipt',
    ]);
  });

  it('keeps erasing when token revocation fails and reports partial', async () => {
    const { deps, receipts, calls } = harness({
      async revokeOAuth() {
        return { revoked: 0, failed: 2 };
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body.error).toBe('partial_erasure');
    expect(receipts[0].oauth).toEqual({ revoked: 0, failed: 2, ok: false });
    expect(calls).toContain(`deleteIdentity:${CANDIDATE}`);
  });

  it('reports partial when storage objects remain', async () => {
    const { deps, receipts } = harness({
      async purgeStorage() {
        throw new Error('storage unavailable');
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(500);
    expect(receipts[0].status).toBe('partial');
    expect(receipts[0].storage).toEqual({ removed: 0, ok: false });
  });

  it('reports partial when the auth identity is not deleted', async () => {
    const { deps, receipts } = harness({
      async deleteIdentity() {
        throw new Error('admin api unavailable');
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(500);
    expect(receipts[0].identity).toEqual({ deleted: false, ok: false });
  });

  it('treats a retry after the profile is gone as a successful erasure', async () => {
    const { deps, receipts } = harness({
      async eraseDatabase() {
        return { erased: false, counts: {} };
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(200);
    expect(receipts[0].status).toBe('completed');
    expect(receipts[0].database.erased).toBe(false);
  });

  it('does not record success when the database erasure fails', async () => {
    const { deps, receipts } = harness({
      async eraseDatabase() {
        throw new Error('rpc unavailable');
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'erase_failed' });
    expect(receipts).toHaveLength(0);
  });

  it('marks a receipt partial when memory cannot be purged', async () => {
    const { deps, receipts } = harness({
      async eraseMemory() {
        throw new Error('disk full');
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body.error).toBe('partial_erasure');
    expect(receipts[0].status).toBe('partial');
    expect(receipts[0].memory).toEqual({ removed: 0, ok: false });
  });

  it('reports receipt failure instead of claiming completion', async () => {
    const { deps } = harness({
      async appendReceipt() {
        throw new Error('disk full');
      },
    });
    const response = await createEraseHandler(deps)(eraseRequest(TOKEN));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'receipt_failed' });
  });
});
