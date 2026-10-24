import type { CandidateOnboardingCompletedPayload } from '@/types/phase3_contracts';
import {
  PHASE4_TAXONOMY_VERSION,
  SIGNAL_CHAPTERS,
  SIGNAL_DEFINITIONS,
  getSignalDefinition,
  type CollegeTier,
  type ExtractedFieldKey,
  type ExtractionResult,
  type IntakeDiagnostics,
  type IntakeSession,
  type SignalDefinition,
  type SignalId,
  type SignalStatus,
  type SignalValue,
} from '@/types/phase4_contracts';

const SIGNAL_IDS = SIGNAL_DEFINITIONS.map((signal) => signal.id);
const SIGNAL_ID_SET = new Set<number>(SIGNAL_IDS);

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export function isSignalId(value: unknown): value is SignalId {
  return typeof value === 'number' && Number.isInteger(value) && SIGNAL_ID_SET.has(value);
}

export function signalKey(signalId: SignalId): string {
  return String(signalId);
}

export function answerValue(
  session: Pick<IntakeSession, 'signals'>,
  signalId: SignalId,
): SignalValue | undefined {
  return session.signals[signalKey(signalId)]?.value;
}

export function extractedFieldValue(
  extraction: ExtractionResult | null,
  key: ExtractedFieldKey,
): string | readonly string[] | number | null {
  if (!extraction) return null;
  const field = extraction.fields.find((candidate) => candidate.key === key);
  return field?.value ?? null;
}

function hasExtractedUrl(extraction: ExtractionResult | null, key: ExtractedFieldKey): boolean {
  const value = extractedFieldValue(extraction, key);
  return typeof value === 'string' && value.trim().length > 0 && value !== 'none';
}

export function conditionalSkipReason(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
  signalId: SignalId,
): 'skipped_conditional' | 'skipped_extracted' | null {
  if (signalId >= 17 && signalId <= 20 && answerValue(session, 16) === 'none') {
    return 'skipped_conditional';
  }

  const interviewStages = answerValue(session, 21);
  if (
    (signalId === 22 || signalId === 23) &&
    Array.isArray(interviewStages) &&
    interviewStages.includes('none_yet')
  ) {
    return 'skipped_conditional';
  }

  if (signalId === 11 && hasExtractedUrl(session.extraction, 'github_url')) {
    return 'skipped_extracted';
  }

  if (signalId === 13 && hasExtractedUrl(session.extraction, 'linkedin_url')) {
    return 'skipped_extracted';
  }

  return null;
}

export function signalStatus(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
  signalId: SignalId,
): SignalStatus {
  const conditional = conditionalSkipReason(session, signalId);
  if (conditional) return conditional;

  const answer = session.signals[signalKey(signalId)];
  if (!answer) return 'unanswered';
  return answer.value === null ? 'skipped_optional' : 'answered';
}

export function nextSignalId(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
): SignalId | null {
  for (const signalId of SIGNAL_IDS) {
    if (signalStatus(session, signalId) === 'unanswered') return signalId;
  }
  return null;
}

export function chapterProgress(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
): Readonly<Record<string, { resolved: number; total: number }>> {
  return Object.fromEntries(
    SIGNAL_CHAPTERS.map((chapter) => [
      chapter.id,
      {
        resolved: chapter.signalIds.filter(
          (signalId) => signalStatus(session, signalId) !== 'unanswered',
        ).length,
        total: chapter.signalIds.length,
      },
    ]),
  );
}

export function allSignalsResolved(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
): boolean {
  return SIGNAL_DEFINITIONS.every((signal) => signalStatus(session, signal.id) !== 'unanswered');
}

export function requiredSignalsResolved(
  session: Pick<IntakeSession, 'signals' | 'extraction'>,
): boolean {
  return SIGNAL_DEFINITIONS.filter((signal) => signal.required).every(
    (signal) => signalStatus(session, signal.id) !== 'unanswered',
  );
}

function isRecord(value: string[]): boolean {
  return value.every((entry) => entry.trim().length > 0);
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOSTS.has(host)) return null;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function validateUrl(value: string, signal: SignalDefinition): string | null {
  if (value === 'none') {
    return signal.allowNone ? null : 'This answer cannot be "none".';
  }

  const url = parseHttpUrl(value);
  if (!url) return 'Enter a valid public http(s) URL.';

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (signal.id === 11 && host !== 'github.com') {
    return 'Signal 11 must be a github.com profile URL.';
  }
  if (signal.id === 13 && host !== 'linkedin.com') {
    return 'Signal 13 must be a linkedin.com profile URL.';
  }

  return null;
}

export type NormalizedSignalValue =
  | { readonly ok: true; readonly value: SignalValue }
  | { readonly ok: false; readonly error: string };

export function normalizeSignalValue(
  signal: SignalDefinition,
  raw: unknown,
): NormalizedSignalValue {
  if (raw === null || raw === undefined) {
    return signal.required
      ? { ok: false, error: 'This question is required.' }
      : { ok: true, value: null };
  }

  if (signal.control === 'boolean') {
    return typeof raw === 'boolean'
      ? { ok: true, value: raw }
      : { ok: false, error: 'Choose yes or no.' };
  }

  if (signal.control === 'single') {
    if (typeof raw !== 'string') return { ok: false, error: 'Choose one option.' };
    const allowed = signal.options?.some((option) => option.value === raw) ?? false;
    return allowed
      ? { ok: true, value: raw }
      : { ok: false, error: 'Choose a listed option.' };
  }

  if (signal.control === 'text') {
    if (typeof raw !== 'string') return { ok: false, error: 'Enter text.' };
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return signal.required
        ? { ok: false, error: 'This answer is required.' }
        : { ok: true, value: null };
    }
    const max = signal.maxChars ?? 500;
    if (trimmed.length > max) {
      return { ok: false, error: `Keep this under ${String(max)} characters.` };
    }
    return { ok: true, value: trimmed };
  }

  if (signal.control === 'url') {
    if (typeof raw !== 'string') return { ok: false, error: 'Enter a URL or choose none.' };
    const trimmed = raw.trim();
    if (trimmed.length === 0 && !signal.required) return { ok: true, value: null };
    if (trimmed.length === 0) return { ok: false, error: 'Enter a URL or choose none.' };
    const urlError = validateUrl(trimmed, signal);
    return urlError ? { ok: false, error: urlError } : { ok: true, value: trimmed };
  }

  if (signal.control === 'url_list') {
    if (!Array.isArray(raw)) return { ok: false, error: 'Add one or more URLs.' };
    if (raw.some((entry) => typeof entry !== 'string')) {
      return { ok: false, error: 'Each entry must be a URL.' };
    }
    const values = Array.from(new Set(raw.map((entry) => entry.trim()).filter(Boolean)));
    if (values.length === 0) {
      return signal.required
        ? { ok: false, error: 'Add at least one URL.' }
        : { ok: true, value: null };
    }
    const max = signal.maxSelections ?? values.length;
    if (values.length > max) return { ok: false, error: `Choose up to ${String(max)}.` };
    for (const value of values) {
      const urlError = validateUrl(value, signal);
      if (urlError) return { ok: false, error: urlError };
    }
    return { ok: true, value: values };
  }

  if (!Array.isArray(raw)) return { ok: false, error: 'Choose one or more options.' };
  if (raw.some((entry) => typeof entry !== 'string')) {
    return { ok: false, error: 'Choose listed options only.' };
  }

  const values = Array.from(new Set(raw));
  if (values.length === 0) {
    return signal.required
      ? { ok: false, error: 'Choose at least one option.' }
      : { ok: true, value: null };
  }

  if (!isRecord(values)) return { ok: false, error: 'Options cannot be blank.' };

  const allowed = new Set(signal.options?.map((option) => option.value) ?? []);
  if (values.some((value) => !allowed.has(value))) {
    return { ok: false, error: 'Choose listed options only.' };
  }

  if (signal.maxSelections && values.length > signal.maxSelections) {
    return {
      ok: false,
      error: `Choose up to ${String(signal.maxSelections)} options.`,
    };
  }

  if (signal.exclusiveOption && values.includes(signal.exclusiveOption) && values.length > 1) {
    return { ok: false, error: 'That option cannot be combined with another.' };
  }

  return { ok: true, value: values };
}

export function sameSignalValue(left: SignalValue | undefined, right: SignalValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function labelForSignalValue(signalId: SignalId, value: string): string {
  const signal = getSignalDefinition(signalId);
  return signal.options?.find((option) => option.value === value)?.label ?? value;
}

export function labelsForSignalValues(signalId: SignalId, values: readonly string[]): string[] {
  return values.map((value) => labelForSignalValue(signalId, value));
}

export function deriveIntakeDiagnostics(
  session: Pick<IntakeSession, 'signals'>,
): IntakeDiagnostics {
  const applications = answerValue(session, 16);
  const replies = answerValue(session, 17);
  const freeOnly = answerValue(session, 28) === true;
  const bottleneck = applications === '31_plus' && replies === 'no';
  const reasons: string[] = [];

  if (bottleneck) {
    reasons.push('31+ recent applications and no recruiter replies: portfolio and signal priority.');
  }
  if (freeOnly) {
    reasons.push('Free learning resources only: restrict every recommendation to zero-cost paths.');
  }

  return { bottleneck, freeOnly, reasons };
}

export type CompletionPayloadResult =
  | { readonly ok: true; readonly payload: CandidateOnboardingCompletedPayload }
  | { readonly ok: false; readonly code: 'INCOMPLETE' };

export function buildCompletionPayload(
  session: IntakeSession,
): CompletionPayloadResult {
  if (!allSignalsResolved(session) || !session.profile.collegeTier) {
    return { ok: false, code: 'INCOMPLETE' };
  }

  const targetRoleValues = answerValue(session, 1);
  if (!Array.isArray(targetRoleValues) || targetRoleValues.length === 0) {
    return { ok: false, code: 'INCOMPLETE' };
  }

  const payload: CandidateOnboardingCompletedPayload = {
    candidate_id: session.candidateId,
    college_tier: session.profile.collegeTier,
    target_roles: labelsForSignalValues(1, targetRoleValues).slice(0, 3),
    preferred_language: session.profile.preferredLanguage,
    autonomy_level: session.profile.autonomyLevel,
  };

  return { ok: true, payload };
}

export function completionEventId(session: Pick<IntakeSession, 'candidateId'>): string {
  return `onboarding:${session.candidateId}:${PHASE4_TAXONOMY_VERSION}`;
}

export function isCollegeTier(value: unknown): value is CollegeTier {
  return value === 'Tier_1' || value === 'Tier_2' || value === 'Tier_3' || value === 'Rural';
}
