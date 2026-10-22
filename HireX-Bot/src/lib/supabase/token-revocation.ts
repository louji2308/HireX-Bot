/**
 * OAuth grant revocation for the DPDP erasure pipeline.
 *
 * Erasing the database row is not enough: a live refresh token keeps granting
 * access after the candidate's data is gone. This module therefore revokes the
 * provider grant *before* the vault row is deleted, and reports a truthful
 * per-provider outcome. A provider whose credentials are not configured is
 * counted as failed, never as revoked.
 */

import { TokenVault, TokenVaultError, type SealedToken } from '@/lib/supabase/vault';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RevocationOutcome {
  readonly revoked: number;
  readonly failed: number;
  readonly ok: boolean;
}

export interface RevocationOptions {
  readonly vault: TokenVault;
  readonly googleClientId?: string;
  readonly googleClientSecret?: string;
  readonly githubClientId?: string;
  readonly githubClientSecret?: string;
  readonly fetchImpl?: FetchLike;
}

const DEFAULT_FETCH: FetchLike = (input, init) => fetch(input, init);

function isSealedToken(value: unknown): value is SealedToken {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.v === 'number' &&
    typeof candidate.kid === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.tag === 'string' &&
    typeof candidate.ciphertext === 'string'
  );
}

export function readVaultEntries(raw: unknown): Array<{ provider: string; sealed: SealedToken }> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  const entries: Array<{ provider: string; sealed: SealedToken }> = [];
  for (const [provider, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isSealedToken(value)) entries.push({ provider: provider.toLowerCase(), sealed: value });
  }
  return entries;
}

async function revokeGoogle(
  token: string,
  fetchImpl: FetchLike,
  clientId?: string,
  clientSecret?: string,
): Promise<boolean> {
  const body = new URLSearchParams({ token });
  if (clientId && clientSecret) {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }
  const response = await fetchImpl('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return response.ok;
}

async function revokeGitHub(
  token: string,
  fetchImpl: FetchLike,
  clientId?: string,
  clientSecret?: string,
): Promise<boolean> {
  if (!clientId || !clientSecret) return false;
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const response = await fetchImpl(
    `https://api.github.com/applications/${encodeURIComponent(clientId)}/token`,
    {
      method: 'DELETE',
      headers: {
        authorization: `Basic ${basic}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: token }),
    },
  );
  return response.status === 204 || response.ok;
}

/**
 * Revokes every sealed provider token stored for a candidate. Individual
 * failures are isolated so one unavailable provider cannot hide the others.
 */
export async function revokeOAuthGrants(
  candidateId: string,
  rawVault: unknown,
  options: RevocationOptions,
): Promise<RevocationOutcome> {
  const entries = readVaultEntries(rawVault);
  if (entries.length === 0) return { revoked: 0, failed: 0, ok: true };

  const fetchImpl = options.fetchImpl ?? DEFAULT_FETCH;
  let revoked = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const token = options.vault.open(entry.sealed, {
        candidateId,
        provider: entry.provider,
        purpose: 'oauth',
      });

      let succeeded = false;
      if (entry.provider === 'google') {
        succeeded = await revokeGoogle(
          token,
          fetchImpl,
          options.googleClientId,
          options.googleClientSecret,
        );
      } else if (entry.provider === 'github') {
        succeeded = await revokeGitHub(
          token,
          fetchImpl,
          options.githubClientId,
          options.githubClientSecret,
        );
      }

      if (succeeded) revoked += 1;
      else failed += 1;
    } catch (error) {
      if (error instanceof TokenVaultError || error instanceof Error) {
        failed += 1;
        continue;
      }
      failed += 1;
    }
  }

  return { revoked, failed, ok: failed === 0 };
}
