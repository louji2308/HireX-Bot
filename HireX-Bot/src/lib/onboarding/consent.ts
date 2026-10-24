import {
  PHASE4_NOTICE_VERSION,
  type ConsentEntry,
  type ConsentLedger,
} from '@/types/phase4_contracts';

export type ConsentSignalId = 30 | 31 | 32 | 33 | 34;

interface ConsentPurpose {
  readonly purpose: string;
  readonly scopes: readonly string[];
}

const PURPOSES: Readonly<Record<ConsentSignalId, ConsentPurpose>> = {
  30: {
    purpose: 'Connect email and read relevant job-search messages',
    scopes: ['gmail.readonly'],
  },
  31: {
    purpose: 'Prepare recruiter outreach drafts',
    scopes: ['draft_only'],
  },
  32: {
    purpose: 'Choose when an email may be sent',
    scopes: ['gmail.send'],
  },
  33: {
    purpose: 'Choose when an application may be submitted',
    scopes: ['application.submit'],
  },
  34: {
    purpose: 'Track applications and schedule follow-ups',
    scopes: ['application.track'],
  },
};

export function isConsentSignalId(value: unknown): value is ConsentSignalId {
  return value === 30 || value === 31 || value === 32 || value === 33 || value === 34;
}

export function consentPurpose(signalId: ConsentSignalId): ConsentPurpose {
  return PURPOSES[signalId];
}

export function createEmptyConsentLedger(): ConsentLedger {
  return {
    noticeVersion: PHASE4_NOTICE_VERSION,
    acknowledgedAt: null,
    entries: [],
  };
}

export function acknowledgeConsentNotice(
  ledger: ConsentLedger,
  at: string,
): ConsentLedger {
  if (ledger.acknowledgedAt) return ledger;
  return { ...ledger, acknowledgedAt: at };
}

export function appendConsentEntry(
  ledger: ConsentLedger,
  input: {
    readonly signalId: ConsentSignalId;
    readonly granted: boolean;
    readonly at: string;
  },
): ConsentLedger {
  const purpose = consentPurpose(input.signalId);
  const entry: ConsentEntry = {
    entryId: `consent:${String(input.signalId)}:${String(ledger.entries.length + 1)}`,
    signalId: input.signalId,
    purpose: purpose.purpose,
    scopes: purpose.scopes,
    granted: input.granted,
    at: input.at,
    actor: 'candidate_local',
  };

  return { ...ledger, entries: [...ledger.entries, entry] };
}

/**
 * Default deny. The latest entry for a signal wins; a revoked entry therefore
 * remains revoked even if an older grant exists.
 */
export function consentGranted(ledger: ConsentLedger, signalId: ConsentSignalId): boolean {
  for (let index = ledger.entries.length - 1; index >= 0; index -= 1) {
    const entry = ledger.entries[index];
    if (entry?.signalId === signalId) return entry.granted;
  }
  return false;
}

export function consentSummary(ledger: ConsentLedger): Record<ConsentSignalId, boolean> {
  return {
    30: consentGranted(ledger, 30),
    31: consentGranted(ledger, 31),
    32: consentGranted(ledger, 32),
    33: consentGranted(ledger, 33),
    34: consentGranted(ledger, 34),
  };
}

export function consentGrantedFromAnswer(
  signalId: ConsentSignalId,
  value: string | boolean | null,
): boolean {
  if (signalId === 30 || signalId === 31 || signalId === 34) return value === true;
  if (signalId === 32 || signalId === 33) return typeof value === 'string' && value !== 'never';
  return false;
}
