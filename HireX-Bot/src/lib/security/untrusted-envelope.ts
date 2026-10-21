/**
 * Untrusted-data envelope (Build Plan.md Step 1.1, Voyager Skill #1).
 *
 * Lesson L-001: normalise and decode HTML entities and URI components BEFORE
 * stripping the closing delimiter, then escape every angle bracket inside the
 * body. A regex that only removes the literal `</untrusted-data>` is defeated
 * by `%3C/untrusted-data%3E`, `&#60;/untrusted-data&#62;` and full-width
 * homoglyphs.
 *
 * The output is deterministic for identical input so it can be hashed and
 * replayed.
 */

import { createHash } from 'node:crypto';

export const MAX_UNTRUSTED_BYTES = 1_000_000;

const CLOSE_DELIMITER = '</untrusted-data>';
const MAX_DECODE_PASSES = 3;
const MAX_STRIP_PASSES = 3;

export type UntrustedEnvelopeErrorCode = 'SIZE_EXCEEDED';

export class UntrustedEnvelopeError extends Error {
  readonly code: UntrustedEnvelopeErrorCode;

  constructor(code: UntrustedEnvelopeErrorCode, message: string) {
    super(message);
    this.name = 'UntrustedEnvelopeError';
    this.code = code;
  }
}

export interface PreparedUntrusted {
  readonly source: string;
  readonly body: string;
  readonly digest: string;
  readonly envelope: string;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
  sol: '/',
  nbsp: ' ',
};

function decodeEntitiesOnce(value: string): string {
  const numeric = value.replace(/&#(?:x([0-9a-fA-F]+)|([0-9]+));?/g, (match, hex: string, dec: string) => {
    const codePoint = Number.parseInt(hex ?? dec, hex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });

  const named = numeric.replace(/&(lt|gt|quot|apos|amp|sol|nbsp);/gi, (match, name: string) => {
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });

  return named.replace(/%[0-9a-fA-F]{2}/g, (match) => {
    try {
      return decodeURIComponent(match);
    } catch {
      return match;
    }
  });
}

function decodeFully(value: string): string {
  let current = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    const next = decodeEntitiesOnce(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function stripDelimiters(value: string): string {
  const pattern = /<\s*\/\s*untrusted[\s_-]*data\s*>/gi;
  let current = value;
  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    const next = current.replace(pattern, '');
    if (next === current) return current;
    current = next;
  }
  return current;
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function escapeBody(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isEnvelopeAlreadyClosed(value: string): boolean {
  return value.endsWith(CLOSE_DELIMITER);
}

export function prepareUntrusted(input: string, source: string): PreparedUntrusted {
  if (Buffer.byteLength(input, 'utf8') > MAX_UNTRUSTED_BYTES) {
    throw new UntrustedEnvelopeError(
      'SIZE_EXCEEDED',
      `Untrusted payload exceeds the ${MAX_UNTRUSTED_BYTES} byte bound.`,
    );
  }

  const normalised = stripControlCharacters(input.normalize('NFKC'));
  const stripped = stripDelimiters(decodeFully(normalised));
  const body = escapeBody(stripped);
  const safeSource = escapeAttribute(source.trim() || 'unknown');

  const digest = createHash('sha256')
    .update(JSON.stringify({ source: safeSource, body }), 'utf8')
    .digest('hex');

  const envelope = `<untrusted-data source="${safeSource}" id="u-${digest.slice(0, 16)}">\n${body}\n${CLOSE_DELIMITER}`;

  return {
    source: safeSource,
    body,
    digest,
    envelope: isEnvelopeAlreadyClosed(envelope) ? envelope : `${envelope}${CLOSE_DELIMITER}`,
  };
}

export function computeUntrustedDigest(input: string, source: string): string {
  return prepareUntrusted(input, source).digest;
}

/**
 * Wraps untrusted content for injection into a prompt. The returned string is
 * the ONLY representation of external content that may enter a model message.
 */
export function sanitizeAndWrapUntrusted(input: string, source: string): string {
  return prepareUntrusted(input, source).envelope;
}
