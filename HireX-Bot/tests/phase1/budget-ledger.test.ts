import { describe, expect, it } from 'vitest';
import { InMemoryBudgetLedger, type InMemoryBudgetOptions } from '@/lib/swarm/budget-ledger';
import type { BudgetScope } from '@/types/phase1_contracts';

const scope: BudgetScope = { candidateId: 'cand-1', sessionId: 'sess-1' };
const otherScope: BudgetScope = { candidateId: 'cand-2', sessionId: 'sess-2' };

function ledger(overrides: InMemoryBudgetOptions = {}) {
  let clock = 1_000;
  const instance = new InMemoryBudgetLedger({
    cloudLimitTokens: 10_000,
    callLimitTokens: 1_000,
    reservationTtlMs: 100,
    now: () => clock,
    ...overrides,
  });
  return { instance, advance: (ms: number) => (clock += ms) };
}

describe('budget ledger reservation identity', () => {
  it('refuses to reuse a request id after settlement', async () => {
    const { instance } = ledger();

    const first = await instance.reserve(scope, 'req-1', 100);
    expect(first.ok).toBe(true);
    const settled = await instance.settle(scope, 'req-1', 80);
    expect(settled.ok).toBe(true);

    const reuse = await instance.reserve(scope, 'req-1', 100);

    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.denial.reason).toBe('RESERVE_LOCKED');
    const snapshot = await instance.snapshot(scope);
    expect(snapshot.cloudReservedTokens).toBe(0);
    expect(snapshot.cloudSpentTokens).toBe(80);
  });

  it('refuses to reuse a request id after release', async () => {
    const { instance } = ledger();

    await instance.reserve(scope, 'req-2', 100);
    await instance.release(scope, 'req-2');
    const reuse = await instance.reserve(scope, 'req-2', 100);

    expect(reuse.ok).toBe(false);
  });

  it('rejects the same request id from a different scope while it is live', async () => {
    const { instance } = ledger();

    await instance.reserve(scope, 'req-3', 100);
    const crossScope = await instance.reserve(otherScope, 'req-3', 100);

    expect(crossScope.ok).toBe(false);
  });

  it('returns the same live reservation for a repeated id without double-reserving', async () => {
    const { instance } = ledger();

    const first = await instance.reserve(scope, 'req-4', 100);
    const second = await instance.reserve(scope, 'req-4', 400);

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.reservation.reservationId).toBe(first.reservation.reservationId);
      expect(second.reservation.reservedTokens).toBe(100);
    }
    const snapshot = await instance.snapshot(scope);
    expect(snapshot.cloudReservedTokens).toBe(100);
  });
});

describe('budget ledger expiry', () => {
  it('reclaims an abandoned reservation before judging the next request', async () => {
    const { instance, advance } = ledger();

    await instance.reserve(scope, 'slow-1', 900);
    expect((await instance.snapshot(scope)).cloudReservedTokens).toBe(900);

    advance(101);
    const next = await instance.reserve(scope, 'next-1', 900);

    expect(next.ok).toBe(true);
    expect((await instance.snapshot(scope)).cloudReservedTokens).toBe(900);
  });

  it('does not reclaim a reservation that is still live', async () => {
    const { instance, advance } = ledger({ cloudLimitTokens: 1_000 });

    await instance.reserve(scope, 'live-1', 600);
    advance(50);
    const next = await instance.reserve(scope, 'live-2', 600);

    expect(next.ok).toBe(false);
    if (!next.ok) expect(next.denial.reason).toBe('GLOBAL_CAP');
  });

  it('reports how many reservations reconcile reclaimed', async () => {
    const { instance, advance } = ledger();

    await instance.reserve(scope, 'a', 100);
    await instance.reserve(scope, 'b', 100);
    advance(200);

    await expect(instance.reconcileExpired(1_200)).resolves.toBe(2);
    await expect(instance.reconcileExpired(1_200)).resolves.toBe(0);
  });
});

describe('budget ledger caps and settlement', () => {
  it('denies a call above the per-call cap', async () => {
    const { instance } = ledger({ callLimitTokens: 50 });

    const result = await instance.reserve(scope, 'big', 51);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denial.reason).toBe('CALL_CAP');
  });

  it('denies a request that would cross the session cap', async () => {
    const { instance } = ledger({ sessionLimitTokens: 150 });

    await instance.reserve(scope, 'one', 100);
    const result = await instance.reserve(scope, 'two', 100);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denial.reason).toBe('SESSION_CAP');
  });

  it('denies a request that would cross the student cap across sessions', async () => {
    const { instance } = ledger({ studentLimitTokens: 150, callLimitTokens: 100 });

    await instance.reserve({ candidateId: 'cand-1', sessionId: 's1' }, 'one', 100);
    const result = await instance.reserve({ candidateId: 'cand-1', sessionId: 's2' }, 'two', 100);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.denial.reason).toBe('STUDENT_CAP');
  });

  it('charges the real total and reports overage above the reservation', async () => {
    const { instance } = ledger();

    await instance.reserve(scope, 'over', 100);
    const settlement = await instance.settle(scope, 'over', 250);

    expect(settlement.ok).toBe(true);
    if (settlement.ok) {
      expect(settlement.overageTokens).toBe(150);
      expect(settlement.snapshot.cloudSpentTokens).toBe(250);
      expect(settlement.snapshot.cloudReservedTokens).toBe(0);
    }
  });

  it('still charges real usage when settle arrives after a premature release', async () => {
    const { instance } = ledger();

    await instance.reserve(scope, 'twice', 100);
    await instance.release(scope, 'twice');
    await instance.release(scope, 'twice');

    const settlement = await instance.settle(scope, 'twice', 10);
    expect(settlement.ok).toBe(true);
    if (settlement.ok) {
      expect(settlement.snapshot.cloudSpentTokens).toBe(10);
      expect(settlement.snapshot.cloudReservedTokens).toBe(0);
    }

    const again = await instance.settle(scope, 'twice', 10);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('ALREADY_SETTLED');
  });
});
