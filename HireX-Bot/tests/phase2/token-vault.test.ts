import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TokenVault, TokenVaultError } from '@/lib/supabase/vault';

const keyA = randomBytes(32).toString('base64');
const keyB = randomBytes(32).toString('base64');
const binding = { candidateId: 'candidate-a', provider: 'github', purpose: 'repo_scan' };

function expectVaultError(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TokenVaultError);
    expect((error as TokenVaultError).code).toBe(code);
    return;
  }
  throw new Error(`Expected TokenVaultError(${code})`);
}

describe('phase 2 — OAuth token vault (AES-256-GCM)', () => {
  it('round-trips a token bound to candidate, provider and purpose', () => {
    const vault = new TokenVault({ k1: keyA });
    const sealed = vault.seal('gho_supersecrettoken', binding);

    expect(vault.open(sealed, binding)).toBe('gho_supersecrettoken');
    expect(vault.activeKid).toBe('k1');
    expect(JSON.stringify(sealed)).not.toContain('gho_supersecrettoken');
    expect(sealed.v).toBe(1);
  });

  it('refuses to open a token under another candidate, provider or purpose', () => {
    const vault = new TokenVault({ k1: keyA });
    const sealed = vault.seal('token', binding);

    expectVaultError(
      () => vault.open(sealed, { ...binding, candidateId: 'candidate-b' }),
      'DECRYPT_FAILED',
    );
    expectVaultError(() => vault.open(sealed, { ...binding, provider: 'google' }), 'DECRYPT_FAILED');
    expectVaultError(() => vault.open(sealed, { ...binding, purpose: 'gmail' }), 'DECRYPT_FAILED');
  });

  it('detects ciphertext and tag tampering', () => {
    const vault = new TokenVault({ k1: keyA });
    const sealed = vault.seal('token', binding);

    const flipped = sealed.ciphertext.startsWith('A') ? `B${sealed.ciphertext.slice(1)}` : `A${sealed.ciphertext.slice(1)}`;
    expectVaultError(() => vault.open({ ...sealed, ciphertext: flipped }, binding), 'DECRYPT_FAILED');

    const badTag = Buffer.alloc(16, 7).toString('base64');
    expectVaultError(() => vault.open({ ...sealed, tag: badTag }, binding), 'DECRYPT_FAILED');
  });

  it('supports key rotation while retaining old ciphertext readability', () => {
    const first = new TokenVault({ k1: keyA });
    const sealed = first.seal('rotating-token', binding);

    const rotated = new TokenVault({ k1: keyA, k2: keyB }, 'k2');
    expect(rotated.open(sealed, binding)).toBe('rotating-token');
    expect(rotated.seal('new-token', binding).kid).toBe('k2');

    const missingOldKey = new TokenVault({ k2: keyB }, 'k2');
    expectVaultError(() => missingOldKey.open(sealed, binding), 'UNKNOWN_KEY');
  });

  it('rejects malformed keyrings and empty tokens', () => {
    expectVaultError(() => new TokenVault({}), 'NOT_CONFIGURED');
    expectVaultError(() => new TokenVault({ k1: 'short' }), 'INVALID_KEYRING');
    expectVaultError(() => new TokenVault({ k1: keyA }, 'missing'), 'INVALID_KEYRING');

    const vault = new TokenVault({ k1: keyA });
    expectVaultError(() => vault.seal('', binding), 'INVALID_TOKEN');
    expectVaultError(
      () => vault.seal('token', { candidateId: '', provider: 'github', purpose: 'x' }),
      'INVALID_PAYLOAD',
    );
  });

  it('reads configuration exclusively from the environment', () => {
    const vault = TokenVault.fromEnvironment({
      TOKEN_VAULT_KEYS: JSON.stringify({ k9: keyA }),
      TOKEN_VAULT_ACTIVE_KEY_ID: 'k9',
    } as unknown as NodeJS.ProcessEnv);
    expect(vault.activeKid).toBe('k9');

    expectVaultError(() => TokenVault.fromEnvironment({} as NodeJS.ProcessEnv), 'NOT_CONFIGURED');
    expectVaultError(
      () =>
        TokenVault.fromEnvironment({
          TOKEN_VAULT_KEYS: JSON.stringify({ k1: 42 }),
        } as unknown as NodeJS.ProcessEnv),
      'INVALID_KEYRING',
    );
  });
});
