import type { ErasureReceipt } from '@/lib/memory/erasure-receipts';
import { erasureCandidateRef, erasureReceiptId } from '@/lib/memory/erasure-receipts';

export interface TokenRevocationResult {
  readonly revoked: number;
  readonly failed: number;
}

export interface EraseDependencies {
  configured(): boolean;
  authenticate(token: string): Promise<{ candidateId: string } | null>;
  revokeOAuth(candidateId: string): Promise<TokenRevocationResult>;
  eraseDatabase(candidateId: string): Promise<{ erased: boolean; counts: Record<string, number> }>;
  eraseMemory(candidateId: string): Promise<{ removed: number }>;
  purgeStorage(candidateId: string): Promise<{ removed: number }>;
  deleteIdentity(candidateId: string): Promise<{ deleted: boolean }>;
  appendReceipt(receipt: ErasureReceipt): Promise<void>;
  now(): Date;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/**
 * DPDP erasure pipeline: authenticate, revoke provider grants, erase database
 * rows, purge memory and storage objects, delete the auth identity, then append
 * a PII-free receipt. Kept outside `app/` because Next.js route modules may only
 * export route entry points and route-segment config.
 *
 * Every stage runs even when an earlier one fails: the candidate's right to
 * erasure is not suspended by one unavailable provider. The receipt records the
 * true per-stage outcome instead of claiming success.
 */
export function createEraseHandler(deps: EraseDependencies) {
  return async function handleErase(request: Request): Promise<Response> {
    const token = bearerToken(request);
    if (!token) {
      return json(401, { error: 'unauthorized' });
    }
    if (!deps.configured()) {
      return json(503, { error: 'not_configured' });
    }

    let identity: { candidateId: string } | null;
    try {
      identity = await deps.authenticate(token);
    } catch {
      identity = null;
    }
    if (!identity) {
      return json(401, { error: 'unauthorized' });
    }

    const candidateId = identity.candidateId;
    const erasedAt = deps.now().toISOString();

    let oauth: { revoked: number; failed: number; ok: boolean };
    try {
      const outcome = await deps.revokeOAuth(candidateId);
      oauth = { revoked: outcome.revoked, failed: outcome.failed, ok: outcome.failed === 0 };
    } catch {
      oauth = { revoked: 0, failed: 1, ok: false };
    }

    let database: { erased: boolean; counts: Record<string, number> };
    try {
      database = await deps.eraseDatabase(candidateId);
    } catch {
      return json(500, { error: 'erase_failed' });
    }

    let memory: { removed: number; ok: boolean };
    try {
      const outcome = await deps.eraseMemory(candidateId);
      memory = { removed: outcome.removed, ok: true };
    } catch {
      memory = { removed: 0, ok: false };
    }

    let storage: { removed: number; ok: boolean };
    try {
      const outcome = await deps.purgeStorage(candidateId);
      storage = { removed: outcome.removed, ok: true };
    } catch {
      storage = { removed: 0, ok: false };
    }

    let identityDeletion: { deleted: boolean; ok: boolean };
    try {
      const outcome = await deps.deleteIdentity(candidateId);
      identityDeletion = { deleted: outcome.deleted, ok: outcome.deleted };
    } catch {
      identityDeletion = { deleted: false, ok: false };
    }

    const completed = oauth.ok && memory.ok && storage.ok && identityDeletion.ok;
    const receipt: ErasureReceipt = {
      schema_version: 1,
      receipt_id: erasureReceiptId(candidateId),
      candidate_ref: erasureCandidateRef(candidateId),
      erased_at: erasedAt,
      status: completed ? 'completed' : 'partial',
      database,
      memory,
      oauth,
      storage,
      identity: identityDeletion,
    };

    try {
      await deps.appendReceipt(receipt);
    } catch {
      return json(500, { error: 'receipt_failed' });
    }

    if (!completed) {
      return json(500, {
        error: 'partial_erasure',
        receipt_id: receipt.receipt_id,
        stages: { oauth, memory, storage, identity: identityDeletion },
      });
    }

    return json(200, {
      status: 'erased',
      receipt_id: receipt.receipt_id,
      database,
      memory_records_removed: memory.removed,
      storage_objects_removed: storage.removed,
      oauth_grants_revoked: oauth.revoked,
      identity_deleted: identityDeletion.deleted,
    });
  };
}
