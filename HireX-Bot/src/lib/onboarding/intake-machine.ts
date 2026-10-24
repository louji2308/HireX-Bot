import { randomBytes, randomUUID } from 'node:crypto';

import {
  allSignalsResolved,
  buildCompletionPayload,
  completionEventId,
  conditionalSkipReason,
  isCollegeTier,
  isSignalId,
  normalizeSignalValue,
  sameSignalValue,
  signalKey,
  signalStatus,
} from '@/lib/onboarding/taxonomy';
import {
  appendConsentEntry,
  acknowledgeConsentNotice,
  consentGrantedFromAnswer,
  isConsentSignalId,
} from '@/lib/onboarding/consent';
import {
  PHASE4_CONTRACT_VERSION,
  PHASE4_TAXONOMY_VERSION,
  getSignalDefinition,
  type AutonomyLevel,
  type CollegeTier,
  type ExtractedField,
  type ExtractionResult,
  type IntakeMutationResult,
  type IntakeSession,
  type ProbeResult,
  type SignalAnswer,
  type SignalId,
  type SignalValue,
  type SupportedLanguage,
} from '@/types/phase4_contracts';

const LANGUAGES: readonly SupportedLanguage[] = ['ta', 'hi', 'te', 'kn', 'bn', 'mr', 'en'];
const AUTONOMY_LEVELS: readonly AutonomyLevel[] = [1, 2, 3, 4];

function timestamp(at?: string): string {
  return at ?? new Date().toISOString();
}

function nextRevision(session: IntakeSession, at: string, patch: Partial<IntakeSession>): IntakeSession {
  return {
    ...session,
    ...patch,
    revision: session.revision + 1,
    updatedAt: at,
  };
}

function rejected(
  session: IntakeSession,
  code: IntakeMutationResult['code'],
): IntakeMutationResult {
  return { status: 'rejected', session, code };
}

function duplicate(session: IntakeSession): IntakeMutationResult {
  return { status: 'duplicate', session };
}

function conflict(session: IntakeSession | null): IntakeMutationResult {
  return { status: 'conflict', session, code: 'CONFLICT' };
}

export function createIntakeSession(input?: {
  readonly candidateId?: string;
  readonly createdAt?: string;
}): IntakeSession {
  const at = timestamp(input?.createdAt);
  return {
    version: 1,
    contractVersion: PHASE4_CONTRACT_VERSION,
    taxonomyVersion: PHASE4_TAXONOMY_VERSION,
    sessionId: randomBytes(32).toString('hex'),
    candidateId: input?.candidateId ?? randomUUID(),
    mode: 'local_draft',
    revision: 0,
    createdAt: at,
    updatedAt: at,
    extraction: null,
    extractionReviewedAt: null,
    profile: {
      collegeTier: null,
      preferredLanguage: 'en',
      autonomyLevel: 2,
    },
    signals: {},
    consent: {
      noticeVersion: 'dpdp-notice.v1',
      acknowledgedAt: null,
      entries: [],
    },
    probe: null,
    completion: null,
  };
}

export function applyExtraction(
  session: IntakeSession,
  extraction: ExtractionResult,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      extraction,
      extractionReviewedAt: null,
    }),
  };
}

export interface ExtractionReviewPatch {
  readonly fields?: Partial<
    Record<string, string | readonly string[] | number | null>
  >;
  readonly collegeTier?: CollegeTier | null;
  readonly preferredLanguage?: SupportedLanguage;
  readonly autonomyLevel?: AutonomyLevel;
}

function normalizeFieldValue(
  value: string | readonly string[] | number | null,
): string | string[] | number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const entries = Array.from(
      new Set(value.map((entry) => String(entry).trim()).filter(Boolean)),
    );
    return entries.length > 0 ? entries : null;
  }
  if (typeof value === 'number') return value;
  return null;
}

export function reviewExtraction(
  session: IntakeSession,
  patch: ExtractionReviewPatch,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (!session.extraction) return rejected(session, 'INVALID_EXTRACTION');

  if (patch.collegeTier !== undefined && patch.collegeTier !== null && !isCollegeTier(patch.collegeTier)) {
    return rejected(session, 'INVALID_VALUE');
  }
  if (patch.preferredLanguage && !LANGUAGES.includes(patch.preferredLanguage)) {
    return rejected(session, 'INVALID_VALUE');
  }
  if (patch.autonomyLevel && !AUTONOMY_LEVELS.includes(patch.autonomyLevel)) {
    return rejected(session, 'INVALID_VALUE');
  }

  const fields: ExtractedField[] = session.extraction.fields.map((field) => {
    if (!patch.fields || !(field.key in patch.fields)) return field;
    const value = normalizeFieldValue(patch.fields[field.key] ?? null);
    return {
      ...field,
      value,
      status: value === null || (Array.isArray(value) && value.length === 0) ? 'missing' : 'confirmed',
      confidence: value === null ? field.confidence : 1,
      source: 'user',
      note: value === null ? 'Left blank by candidate' : 'Confirmed by candidate',
    };
  });

  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      extraction: { ...session.extraction, fields },
      extractionReviewedAt: appliedAt,
      profile: {
        collegeTier:
          patch.collegeTier === undefined ? session.profile.collegeTier : patch.collegeTier,
        preferredLanguage: patch.preferredLanguage ?? session.profile.preferredLanguage,
        autonomyLevel: patch.autonomyLevel ?? session.profile.autonomyLevel,
      },
    }),
  };
}

export function applyAnswer(
  session: IntakeSession,
  signalId: number,
  raw: unknown,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (!isSignalId(signalId)) return rejected(session, 'INVALID_SIGNAL');

  const skip = conditionalSkipReason(session, signalId);
  if (skip) return duplicate(session);

  const normalized = normalizeSignalValue(getSignalDefinition(signalId), raw);
  if (!normalized.ok) return rejected(session, 'INVALID_VALUE');

  const existing = session.signals[signalKey(signalId)];
  if (existing && sameSignalValue(existing.value, normalized.value)) {
    return duplicate(session);
  }

  const appliedAt = timestamp(at);
  const answer: SignalAnswer = {
    signalId,
    value: normalized.value,
    answeredAt: appliedAt,
    revision: session.revision + 1,
  };

  const signals = { ...session.signals, [signalKey(signalId)]: answer };
  let consent = session.consent;
  if (isConsentSignalId(signalId)) {
    const permissionValue = normalized.value;
    const granted =
      typeof permissionValue === 'string' ||
      typeof permissionValue === 'boolean' ||
      permissionValue === null
        ? consentGrantedFromAnswer(signalId, permissionValue)
        : false;
    consent = appendConsentEntry(consent, {
      signalId,
      granted,
      at: appliedAt,
    });
  }

  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, { signals, consent }),
  };
}

export function skipSignal(
  session: IntakeSession,
  signalId: number,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (!isSignalId(signalId)) return rejected(session, 'INVALID_SIGNAL');

  const definition = getSignalDefinition(signalId);
  if (definition.required) return rejected(session, 'SIGNAL_REQUIRED');

  const skip = conditionalSkipReason(session, signalId);
  if (skip) return duplicate(session);

  const existing = session.signals[signalKey(signalId)];
  if (existing && existing.value === null) return duplicate(session);

  const appliedAt = timestamp(at);
  const answer: SignalAnswer = {
    signalId,
    value: null,
    answeredAt: appliedAt,
    revision: session.revision + 1,
  };

  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      signals: { ...session.signals, [signalKey(signalId)]: answer },
    }),
  };
}

export function acknowledgeNotice(
  session: IntakeSession,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (session.consent.acknowledgedAt) return duplicate(session);

  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      consent: acknowledgeConsentNotice(session.consent, appliedAt),
    }),
  };
}

export function updateWorkspaceProfile(
  session: IntakeSession,
  patch: {
    readonly collegeTier?: CollegeTier | null;
    readonly preferredLanguage?: SupportedLanguage;
    readonly autonomyLevel?: AutonomyLevel;
  },
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (patch.collegeTier !== undefined && patch.collegeTier !== null && !isCollegeTier(patch.collegeTier)) {
    return rejected(session, 'INVALID_VALUE');
  }
  if (patch.preferredLanguage && !LANGUAGES.includes(patch.preferredLanguage)) {
    return rejected(session, 'INVALID_VALUE');
  }
  if (patch.autonomyLevel && !AUTONOMY_LEVELS.includes(patch.autonomyLevel)) {
    return rejected(session, 'INVALID_VALUE');
  }

  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      profile: {
        collegeTier:
          patch.collegeTier === undefined ? session.profile.collegeTier : patch.collegeTier,
        preferredLanguage: patch.preferredLanguage ?? session.profile.preferredLanguage,
        autonomyLevel: patch.autonomyLevel ?? session.profile.autonomyLevel,
      },
    }),
  };
}

export function recordProbe(
  session: IntakeSession,
  probe: ProbeResult,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (probe.score !== null && (probe.score < 0 || probe.score > 100)) {
    return rejected(session, 'INVALID_VALUE');
  }
  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, { probe }),
  };
}

export function completeIntake(
  session: IntakeSession,
  at: string | undefined,
  expectedRevision: number,
): IntakeMutationResult {
  if (expectedRevision !== session.revision) return conflict(session);
  if (session.completion) return duplicate(session);

  if (!allSignalsResolved(session) || !session.consent.acknowledgedAt) {
    return rejected(session, 'INCOMPLETE');
  }

  const built = buildCompletionPayload(session);
  if (!built.ok) return rejected(session, built.code);

  const appliedAt = timestamp(at);
  return {
    status: 'applied',
    session: nextRevision(session, appliedAt, {
      completion: {
        eventId: completionEventId(session),
        completedAt: appliedAt,
        payload: built.payload,
        fanOut: {
          durable: false,
          source: 'local_preview',
          lanes: ['discovery', 'application_prep', 'training'],
        },
      },
    }),
  };
}

export function canComplete(session: IntakeSession): boolean {
  return (
    allSignalsResolved(session) &&
    Boolean(session.consent.acknowledgedAt) &&
    session.profile.collegeTier !== null
  );
}

export function isResolvedSignal(session: IntakeSession, signalId: SignalId): boolean {
  return signalStatus(session, signalId) !== 'unanswered';
}

export function unansweredRequiredSignals(session: IntakeSession): SignalId[] {
  return getUnresolvedSignals(session).filter((signalId) => getSignalDefinition(signalId).required);
}

function getUnresolvedSignals(session: IntakeSession): SignalId[] {
  return Array.from({ length: 34 }, (_, index) => (index + 1) as SignalId).filter(
    (signalId) => !isResolvedSignal(session, signalId),
  );
}

export function valueForConsent(session: IntakeSession, signalId: SignalId): SignalValue | undefined {
  return session.signals[signalKey(signalId)]?.value;
}
