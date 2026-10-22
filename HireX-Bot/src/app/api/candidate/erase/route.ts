import { join } from 'node:path';
import { JsonlMemoryStore } from '@/lib/memory/consolidator';
import { JsonlErasureReceiptStore } from '@/lib/memory/erasure-receipts';
import { resolveSupabaseConfig } from '@/lib/supabase/config';
import { createEraseHandler, type EraseDependencies } from '@/lib/supabase/erase-handler';
import { createServiceClient, createUserClient } from '@/lib/supabase/server';
import { purgeCandidateStorage, storageBucketsFromEnvironment } from '@/lib/supabase/storage';
import {
  readVaultEntries,
  revokeOAuthGrants,
} from '@/lib/supabase/token-revocation';
import { TokenVault } from '@/lib/supabase/vault';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultDependencies(): EraseDependencies {
  const memoryStore = new JsonlMemoryStore(join(process.cwd(), 'swarm/memory/memory.jsonl'));
  const receiptStore = new JsonlErasureReceiptStore(
    join(process.cwd(), 'swarm/memory/erasure_receipts.jsonl'),
  );

  return {
    configured: () => resolveSupabaseConfig().config !== null,
    async authenticate(token) {
      const client = createUserClient(token);
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return { candidateId: data.user.id };
    },
    async revokeOAuth(candidateId) {
      const client = createServiceClient();
      const { data, error } = await client
        .from('candidate_profiles')
        .select('oauth_token_vault')
        .eq('id', candidateId)
        .maybeSingle();
      if (error) throw new Error(error.message);

      const entries = readVaultEntries(data?.oauth_token_vault);
      if (entries.length === 0) return { revoked: 0, failed: 0 };

      let vault: TokenVault;
      try {
        vault = TokenVault.fromEnvironment();
      } catch {
        return { revoked: 0, failed: entries.length };
      }

      const outcome = await revokeOAuthGrants(candidateId, data?.oauth_token_vault, {
        vault,
        googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        githubClientId: process.env.GITHUB_OAUTH_CLIENT_ID,
        githubClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      });
      return { revoked: outcome.revoked, failed: outcome.failed };
    },
    async eraseDatabase(candidateId) {
      const client = createServiceClient();
      const { data, error } = await client.rpc('erase_candidate', { p_candidate_id: candidateId });
      if (error) throw new Error(error.message);
      const parsed = (data ?? {}) as { erased?: boolean; counts?: Record<string, number> };
      return { erased: parsed.erased === true, counts: parsed.counts ?? {} };
    },
    async eraseMemory(candidateId) {
      const { removed } = await memoryStore.eraseCandidate(candidateId);
      return { removed };
    },
    async purgeStorage(candidateId) {
      const client = createServiceClient();
      const outcome = await purgeCandidateStorage(
        client,
        candidateId,
        storageBucketsFromEnvironment(),
      );
      if (!outcome.ok) throw new Error('storage purge incomplete');
      return { removed: outcome.removed };
    },
    async deleteIdentity(candidateId) {
      const client = createServiceClient();
      const { error } = await client.auth.admin.deleteUser(candidateId);
      if (!error) return { deleted: true };
      const message = error.message.toLowerCase();
      if (message.includes('not found') || message.includes('user_not_found')) {
        return { deleted: true };
      }
      throw new Error(error.message);
    },
    async appendReceipt(receipt) {
      await receiptStore.append(receipt);
    },
    now: () => new Date(),
  };
}

export async function DELETE(request: Request): Promise<Response> {
  const deps = defaultDependencies();
  return createEraseHandler(deps)(request);
}
