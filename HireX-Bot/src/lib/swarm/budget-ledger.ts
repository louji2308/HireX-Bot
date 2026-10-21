/**
 * Token budget ledger (Build Plan.md Step 1.4, ADR-002).
 *
 * Two facts drive this file:
 *  1. The 1,000,000-token SMART-Code grant is NOT verified. The stated workload
 *     (~5.2M tokens across 20 sessions) exceeds it, so an unverified grant is
 *     clamped to a conservative operating limit and every snapshot reports
 *     `grantVerified: false`.
 *  2. The check-then-act race is the classic overspend bug. `reserve` mutates
 *     synchronously between the cap read and the reservation write, so two
 *     concurrent callers cannot both pass the same cap.
 *
 * `callLimitTokens` bounds the completion budget reserved for one call. Prompt
 * tokens are not part of the reservation because they are only known exactly
 * after the gateway reports usage; settlement charges the real total and reports
 * any `overageTokens` above the reservation.
 *
 * PHASE 1 LIMITATION (must be carried into Phase 2): state is process-local, so
 * it is correct for a single Node instance only. Multi-instance deployment needs
 * an atomic store (Postgres `UPDATE ... WHERE` or an advisory lock) behind the
 * same interface.
 */

import type {
  BudgetDenial,
  BudgetDenialReason,
  BudgetLedger,
  BudgetLevel,
  BudgetReservation,
  BudgetReserveResult,
  BudgetScope,
  BudgetSettlement,
  BudgetSnapshot,
} from '@/types/phase1_contracts';

export const DECLARED_GRANT_TOKENS = 1_000_000;
export const GRANT_RESERVE_TOKENS = 150_000;
/** Conservative ceiling used while the grant size is unverified. */
export const UNVERIFIED_CLOUD_LIMIT_TOKENS = 300_000;

export const DEFAULT_SESSION_LIMIT_TOKENS = 80_000;
export const DEFAULT_STUDENT_LIMIT_TOKENS = 30_000;
export const DEFAULT_CALL_LIMIT_TOKENS = 4_000;
export const DEFAULT_RESERVATION_TTL_MS = 120_000;

export const LEVEL_THRESHOLDS = {
  L1: 0.6,
  L2: 0.8,
  L3: 0.9,
  L4: 0.97,
} as const;

export interface InMemoryBudgetOptions {
  readonly declaredGrantTokens?: number;
  readonly reserveTokens?: number;
  readonly cloudLimitTokens?: number;
  readonly grantVerified?: boolean;
  readonly sessionLimitTokens?: number;
  readonly studentLimitTokens?: number;
  readonly callLimitTokens?: number;
  readonly reservationTtlMs?: number;
  readonly now?: () => number;
}

interface ReservationRecord {
  readonly reservationId: string;
  readonly scopeKey: string;
  readonly candidateId: string;
  readonly sessionId: string;
  readonly reservedTokens: number;
  readonly expiresAtMs: number;
  settled: boolean;
  released: boolean;
  actualTokens: number;
}

function scopeKey(scope: BudgetScope): string {
  return `${scope.candidateId}\u0000${scope.sessionId}`;
}

function levelFor(cloudLimitTokens: number, committedTokens: number): BudgetLevel {
  if (cloudLimitTokens <= 0) return 'L4';
  const ratio = committedTokens / cloudLimitTokens;
  if (ratio >= LEVEL_THRESHOLDS.L4) return 'L4';
  if (ratio >= LEVEL_THRESHOLDS.L3) return 'L3';
  if (ratio >= LEVEL_THRESHOLDS.L2) return 'L2';
  if (ratio >= LEVEL_THRESHOLDS.L1) return 'L1';
  return 'L0';
}

export class InMemoryBudgetLedger implements BudgetLedger {
  private readonly declaredGrantTokens: number;
  private readonly reserveTokens: number;
  private readonly cloudLimitTokens: number;
  private readonly grantVerified: boolean;
  private readonly sessionLimitTokens: number;
  private readonly studentLimitTokens: number;
  private readonly callLimitTokens: number;
  private readonly reservationTtlMs: number;
  private readonly now: () => number;

  private cloudSpentTokens = 0;
  private cloudReservedTokens = 0;
  private readonly sessionSpent = new Map<string, number>();
  private readonly studentSpent = new Map<string, number>();
  private readonly reservations = new Map<string, ReservationRecord>();
  private reservationCounter = 0;

  constructor(options: InMemoryBudgetOptions = {}) {
    this.declaredGrantTokens = options.declaredGrantTokens ?? DECLARED_GRANT_TOKENS;
    this.reserveTokens = options.reserveTokens ?? GRANT_RESERVE_TOKENS;
    this.grantVerified = options.grantVerified ?? false;

    const usable = Math.max(0, this.declaredGrantTokens - this.reserveTokens);
    const clamped = this.grantVerified
      ? usable
      : Math.min(usable, UNVERIFIED_CLOUD_LIMIT_TOKENS);
    this.cloudLimitTokens = options.cloudLimitTokens ?? clamped;

    this.sessionLimitTokens = options.sessionLimitTokens ?? DEFAULT_SESSION_LIMIT_TOKENS;
    this.studentLimitTokens = options.studentLimitTokens ?? DEFAULT_STUDENT_LIMIT_TOKENS;
    this.callLimitTokens = options.callLimitTokens ?? DEFAULT_CALL_LIMIT_TOKENS;
    this.reservationTtlMs = options.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  /** Test/seed hook only: accounts for tokens already spent before this process. */
  seedSpend(tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    this.cloudSpentTokens += Math.floor(tokens);
  }

  async snapshot(scope: BudgetScope): Promise<BudgetSnapshot> {
    const committed = this.cloudSpentTokens + this.cloudReservedTokens;
    return {
      level: levelFor(this.cloudLimitTokens, committed),
      grantVerified: this.grantVerified,
      declaredGrantTokens: this.declaredGrantTokens,
      reserveTokens: this.reserveTokens,
      cloudLimitTokens: this.cloudLimitTokens,
      cloudSpentTokens: this.cloudSpentTokens,
      cloudReservedTokens: this.cloudReservedTokens,
      sessionSpentTokens: this.sessionSpent.get(scope.sessionId) ?? 0,
      sessionLimitTokens: this.sessionLimitTokens,
      studentSpentTokens: this.studentSpent.get(scope.candidateId) ?? 0,
      studentLimitTokens: this.studentLimitTokens,
      callLimitTokens: this.callLimitTokens,
    };
  }

  private deny(reason: BudgetDenialReason, scope: BudgetScope): BudgetReserveResult {
    const denial: BudgetDenial = {
      reason,
      snapshot: this.snapshotSync(scope),
    };
    return { ok: false, denial };
  }

  private snapshotSync(scope: BudgetScope): BudgetSnapshot {
    const committed = this.cloudSpentTokens + this.cloudReservedTokens;
    return {
      level: levelFor(this.cloudLimitTokens, committed),
      grantVerified: this.grantVerified,
      declaredGrantTokens: this.declaredGrantTokens,
      reserveTokens: this.reserveTokens,
      cloudLimitTokens: this.cloudLimitTokens,
      cloudSpentTokens: this.cloudSpentTokens,
      cloudReservedTokens: this.cloudReservedTokens,
      sessionSpentTokens: this.sessionSpent.get(scope.sessionId) ?? 0,
      sessionLimitTokens: this.sessionLimitTokens,
      studentSpentTokens: this.studentSpent.get(scope.candidateId) ?? 0,
      studentLimitTokens: this.studentLimitTokens,
      callLimitTokens: this.callLimitTokens,
    };
  }

  async reserve(
    scope: BudgetScope,
    requestId: string,
    estimatedTokens: number,
  ): Promise<BudgetReserveResult> {
    const amount = Math.ceil(estimatedTokens);
    if (!Number.isFinite(amount) || amount <= 0) return this.deny('INVALID_AMOUNT', scope);

    // A request id is single-use. Reusing one that was already settled or
    // released used to return a stale reservation, so the follow-up settle
    // always failed with ALREADY_SETTLED and the caller could never spend again.
    const existing = this.reservations.get(requestId);
    if (existing) {
      if (existing.scopeKey !== scopeKey(scope) || existing.settled || existing.released) {
        return this.deny('RESERVE_LOCKED', scope);
      }
      return {
        ok: true,
        reservation: {
          reservationId: existing.reservationId,
          reservedTokens: existing.reservedTokens,
          expiresAtMs: existing.expiresAtMs,
          snapshot: this.snapshotSync(scope),
        },
      };
    }

    // Reclaim abandoned reservations before the caps are read; otherwise a
    // crashed call leaks capacity forever because nothing else calls reconcile.
    this.reclaimExpired(this.now());

    if (amount > this.callLimitTokens) return this.deny('CALL_CAP', scope);

    // Outstanding reservations count against the scope caps. Checking only
    // settled spend let two concurrent calls each pass the same cap.
    const sessionCommitted = this.committedForScope('sessionId', scope.sessionId);
    if (sessionCommitted + amount > this.sessionLimitTokens) return this.deny('SESSION_CAP', scope);

    const studentCommitted = this.committedForScope('candidateId', scope.candidateId);
    if (studentCommitted + amount > this.studentLimitTokens) return this.deny('STUDENT_CAP', scope);

    const committed = this.cloudSpentTokens + this.cloudReservedTokens;
    if (levelFor(this.cloudLimitTokens, committed) === 'L4') {
      return this.deny('RESERVE_LOCKED', scope);
    }
    if (committed + amount > this.cloudLimitTokens) return this.deny('GLOBAL_CAP', scope);

    this.reservationCounter += 1;
    const record: ReservationRecord = {
      reservationId: `rsv_${this.reservationCounter}`,
      scopeKey: scopeKey(scope),
      candidateId: scope.candidateId,
      sessionId: scope.sessionId,
      reservedTokens: amount,
      expiresAtMs: this.now() + this.reservationTtlMs,
      settled: false,
      released: false,
      actualTokens: 0,
    };
    this.reservations.set(requestId, record);
    this.cloudReservedTokens += amount;

    return {
      ok: true,
      reservation: {
        reservationId: record.reservationId,
        reservedTokens: record.reservedTokens,
        expiresAtMs: record.expiresAtMs,
        snapshot: this.snapshotSync(scope),
      },
    };
  }

  async settle(
    scope: BudgetScope,
    requestId: string,
    actualTokens: number,
  ): Promise<BudgetSettlement> {
    const record = this.reservations.get(requestId);
    if (!record) {
      return { ok: false, reason: 'UNKNOWN_RESERVATION', snapshot: this.snapshotSync(scope) };
    }
    if (record.scopeKey !== scopeKey(scope)) {
      return { ok: false, reason: 'SCOPE_MISMATCH', snapshot: null };
    }
    if (record.settled) {
      return { ok: false, reason: 'ALREADY_SETTLED', snapshot: this.snapshotSync(scope) };
    }

    const actual = Number.isFinite(actualTokens) ? Math.max(0, Math.ceil(actualTokens)) : 0;
    record.settled = true;
    record.actualTokens = actual;

    this.cloudReservedTokens = Math.max(0, this.cloudReservedTokens - record.reservedTokens);
    this.cloudSpentTokens += actual;
    this.sessionSpent.set(
      scope.sessionId,
      (this.sessionSpent.get(scope.sessionId) ?? 0) + actual,
    );
    this.studentSpent.set(
      scope.candidateId,
      (this.studentSpent.get(scope.candidateId) ?? 0) + actual,
    );

    return {
      ok: true,
      snapshot: this.snapshotSync(scope),
      overageTokens: Math.max(0, actual - record.reservedTokens),
    };
  }

  async release(scope: BudgetScope, requestId: string): Promise<void> {
    const record = this.reservations.get(requestId);
    if (!record || record.settled || record.released) return;
    if (record.scopeKey !== scopeKey(scope)) return;
    record.released = true;
    this.cloudReservedTokens = Math.max(0, this.cloudReservedTokens - record.reservedTokens);
  }

  /** Settled spend plus live reservations for one dimension of a scope. */
  private committedForScope(field: 'sessionId' | 'candidateId', value: string): number {
    const spent =
      field === 'sessionId'
        ? (this.sessionSpent.get(value) ?? 0)
        : (this.studentSpent.get(value) ?? 0);

    let reserved = 0;
    for (const record of this.reservations.values()) {
      if (record.settled || record.released) continue;
      if (record[field] !== value) continue;
      reserved += record.reservedTokens;
    }

    return spent + reserved;
  }

  private reclaimExpired(nowMs: number): number {
    let reclaimed = 0;
    for (const record of this.reservations.values()) {
      if (record.settled || record.released) continue;
      if (record.expiresAtMs > nowMs) continue;
      record.released = true;
      this.cloudReservedTokens = Math.max(0, this.cloudReservedTokens - record.reservedTokens);
      reclaimed += 1;
    }
    return reclaimed;
  }

  async reconcileExpired(nowMs: number): Promise<number> {
    return this.reclaimExpired(nowMs);
  }
}
