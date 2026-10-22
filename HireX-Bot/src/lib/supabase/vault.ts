/**
 * Phase 2 OAuth token vault (Architecture A5, AGENTS.md A14).
 *
 * Tokens are sealed at the application layer with AES-256-GCM before they touch
 * `candidate_profiles.oauth_token_vault`. AAD binds each ciphertext to the
 * candidate, provider and purpose, so a row copied to another candidate or
 * replayed into another flow fails authentication instead of decrypting.
 *
 * Key material comes only from the environment (`TOKEN_VAULT_KEYS`), never from
 * the database, because a key stored beside the ciphertext protects nothing.
 * Rotation is supported by key id; old ciphertexts remain readable while the
 * `kid` still exists in the keyring.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_VAULT_VERSION = 1 as const;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AAD_PREFIX = 'hirex-token-v1';

export type TokenVaultErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_KEYRING'
  | 'INVALID_TOKEN'
  | 'INVALID_PAYLOAD'
  | 'UNKNOWN_KEY'
  | 'DECRYPT_FAILED';

export class TokenVaultError extends Error {
  readonly code: TokenVaultErrorCode;

  constructor(code: TokenVaultErrorCode, message: string) {
    super(message);
    this.name = 'TokenVaultError';
    this.code = code;
  }
}

export interface SealedToken {
  readonly v: typeof TOKEN_VAULT_VERSION;
  readonly kid: string;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

export interface TokenBinding {
  readonly candidateId: string;
  readonly provider: string;
  readonly purpose: string;
}

function assertBinding(binding: TokenBinding): void {
  if (!binding.candidateId || !binding.provider || !binding.purpose) {
    throw new TokenVaultError('INVALID_PAYLOAD', 'candidateId, provider and purpose are required.');
  }
}

function aadFor(binding: TokenBinding): Buffer {
  return Buffer.from(
    `${AAD_PREFIX}|${binding.candidateId}|${binding.provider.toLowerCase()}|${binding.purpose.toLowerCase()}`,
    'utf8',
  );
}

export class TokenVault {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly activeKeyId: string;

  constructor(keyring: Readonly<Record<string, string>>, activeKeyId?: string) {
    if (Object.keys(keyring).length === 0) {
      throw new TokenVaultError('NOT_CONFIGURED', 'TOKEN_VAULT_KEYS is empty.');
    }

    const decoded = new Map<string, Buffer>();
    for (const [keyId, encoded] of Object.entries(keyring)) {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyId)) {
        throw new TokenVaultError('INVALID_KEYRING', `Key id "${keyId}" is not URL-safe.`);
      }
      const key = Buffer.from(encoded, 'base64');
      if (key.length !== KEY_BYTES) {
        throw new TokenVaultError(
          'INVALID_KEYRING',
          `Key "${keyId}" must decode to exactly ${KEY_BYTES} bytes.`,
        );
      }
      decoded.set(keyId, key);
    }

    const selected = activeKeyId ?? [...decoded.keys()].sort().at(-1);
    if (!selected || !decoded.has(selected)) {
      throw new TokenVaultError('INVALID_KEYRING', 'Active key id is missing from the keyring.');
    }

    this.keys = decoded;
    this.activeKeyId = selected;
  }

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): TokenVault {
    const raw = environment.TOKEN_VAULT_KEYS;
    if (!raw || raw.trim().length === 0) {
      throw new TokenVaultError('NOT_CONFIGURED', 'TOKEN_VAULT_KEYS is not set.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new TokenVaultError('INVALID_KEYRING', 'TOKEN_VAULT_KEYS must be a JSON object.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new TokenVaultError('INVALID_KEYRING', 'TOKEN_VAULT_KEYS must be a JSON object.');
    }

    const keyring: Record<string, string> = {};
    for (const [keyId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        throw new TokenVaultError('INVALID_KEYRING', `Key "${keyId}" must be a base64 string.`);
      }
      keyring[keyId] = value;
    }

    return new TokenVault(keyring, environment.TOKEN_VAULT_ACTIVE_KEY_ID);
  }

  get activeKid(): string {
    return this.activeKeyId;
  }

  seal(token: string, binding: TokenBinding): SealedToken {
    assertBinding(binding);
    if (typeof token !== 'string' || token.length === 0) {
      throw new TokenVaultError('INVALID_TOKEN', 'Token must be a non-empty string.');
    }

    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new TokenVaultError('UNKNOWN_KEY', `Active key "${this.activeKeyId}" is unavailable.`);
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aadFor(binding));
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

    return {
      v: TOKEN_VAULT_VERSION,
      kid: this.activeKeyId,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  open(sealed: SealedToken, binding: TokenBinding): string {
    assertBinding(binding);
    if (!sealed || sealed.v !== TOKEN_VAULT_VERSION) {
      throw new TokenVaultError('INVALID_PAYLOAD', 'Unsupported sealed-token version.');
    }

    const key = this.keys.get(sealed.kid);
    if (!key) {
      throw new TokenVaultError('UNKNOWN_KEY', `Key "${sealed.kid}" is not in the keyring.`);
    }

    const iv = Buffer.from(sealed.iv, 'base64');
    const tag = Buffer.from(sealed.tag, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== 16) {
      throw new TokenVaultError('INVALID_PAYLOAD', 'Sealed token has an invalid IV or tag length.');
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(aadFor(binding));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new TokenVaultError(
        'DECRYPT_FAILED',
        'Token failed authentication for this candidate, provider and purpose.',
      );
    }
  }
}

/**
 * Constant-time comparison helper for non-secret identifiers where equality is
 * security-relevant. Exposed for callers that compare token-derived digests.
 */
export function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
