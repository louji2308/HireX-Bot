import { describe, expect, it } from 'vitest';

import { verifyWorkflowAuditChain } from '@/inngest/audit';
import { findWorkflowTransitionEdge, resolveApprovalDecision } from '@/inngest/state-machine';
import { InMemoryWorkflowStateStore } from '@/inngest/task-state-store';
import {
  APPROVAL_TIMEOUT_HOURS,
  MAX_WORKFLOW_ATTEMPTS,
  WORKFLOW_TRANSITION_EDGES,
  type WorkflowState,
  type WorkflowTransitionRequest,
} from '@/types/phase3_contracts';

const TASK_ID = 'task-1';
const CANDIDATE_ID = '00000000-0000-4000-8000-000000000001';
const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T01:00:00.000Z';
const EXPIRES = '2026-01-04T00:00:00.000Z';

function transition(
  to: WorkflowState,
  reason: WorkflowTransitionRequest['reason'],
  expectedVersion: number,
  overrides: Partial<WorkflowTransitionRequest> = {},
): WorkflowTransitionRequest {
  return {
    taskId: TASK_ID,
    candidateId: CANDIDATE_ID,
    to,
    reason,
    expectedVersion,
    eventId: `event-${reason}`,
    stepName: `step-${reason}`,
    actor: 'worker',
    occurredAt: T0,
    ...overrides,
  };
}

function enqueue(store: InMemoryWorkflowStateStore) {
  return store.apply(transition('planned', 'task_enqueued', 0));
}

function advanceToApproval(store: InMemoryWorkflowStateStore) {
  enqueue(store);
  store.apply(transition('running', 'worker_acquired', 1));
  return store.apply(
    transition('awaiting_approval', 'approval_required', 2, {
      approvalExpiresAt: EXPIRES,
    }),
  );
}

describe('workflow state machine', () => {
  it('freezes exactly eleven legal edges and no seventh state', () => {
    expect(APPROVAL_TIMEOUT_HOURS).toBe(72);
    expect(WORKFLOW_TRANSITION_EDGES).toHaveLength(11);
    expect(new Set(WORKFLOW_TRANSITION_EDGES.map((edge) => `${edge.from}:${edge.to}:${edge.reason}`)).size).toBe(11);
    expect(findWorkflowTransitionEdge('planned', 'completed', 'step_succeeded')).toBeNull();
  });

  it('enqueues a task at version 1 and refuses a second enqueue', () => {
    const store = new InMemoryWorkflowStateStore();

    expect(store.durable).toBe(false);
    const first = enqueue(store);

    expect(first.status).toBe('applied');
    expect(first.snapshot).toMatchObject({
      state: 'planned',
      version: 1,
      attempt: 1,
      outcome: null,
      sideEffectExecuted: false,
    });
    const secondEnqueue = store.apply(
      transition('planned', 'task_enqueued', 1, { eventId: 'second-enqueue' }),
    );
    expect(secondEnqueue.code).toBe('TASK_ALREADY_EXISTS');
  });

  it('moves a task through approval to a successful completion', () => {
    const store = new InMemoryWorkflowStateStore();
    expect(advanceToApproval(store).snapshot?.state).toBe('awaiting_approval');

    const granted = store.apply(
      transition('running', 'approval_granted', 3, { occurredAt: T1, actor: 'candidate' }),
    );
    expect(granted.snapshot).toMatchObject({
      state: 'running',
      approvalExpiresAt: null,
      approvalGranted: true,
      version: 4,
    });

    const completed = store.apply(
      transition('completed', 'step_succeeded', 4, {
        occurredAt: '2026-01-01T02:00:00.000Z',
        outcome: 'succeeded',
        sideEffectExecuted: true,
      }),
    );

    expect(completed.status).toBe('applied');
    expect(completed.snapshot).toMatchObject({
      state: 'completed',
      outcome: 'succeeded',
      sideEffectExecuted: true,
      approvalGranted: true,
      version: 5,
    });
    expect(verifyWorkflowAuditChain(store.history(TASK_ID))).toEqual({ valid: true, errors: [] });
  });

  it('refuses a side-effecting completion that skipped recorded approval', () => {
    const store = new InMemoryWorkflowStateStore();
    enqueue(store);
    store.apply(transition('running', 'worker_acquired', 1, { eventId: 'run-1' }));

    const unsafe = store.apply(
      transition('completed', 'step_succeeded', 2, {
        eventId: 'complete-with-side-effect',
        outcome: 'succeeded',
        sideEffectExecuted: true,
      }),
    );

    expect(unsafe.code).toBe('APPROVAL_REQUIRED_FOR_SIDE_EFFECT');
    expect(unsafe.snapshot).toMatchObject({
      state: 'running',
      sideEffectExecuted: false,
      approvalGranted: false,
    });
  });

  it('treats candidate rejection as a cancelled completion with no external side effect', () => {
    const store = new InMemoryWorkflowStateStore();
    advanceToApproval(store);

    const rejected = store.apply(
      transition('completed', 'approval_rejected', 3, {
        occurredAt: T1,
        actor: 'candidate',
        outcome: 'cancelled',
      }),
    );

    expect(rejected.status).toBe('applied');
    expect(rejected.snapshot).toMatchObject({
      state: 'completed',
      outcome: 'cancelled',
      sideEffectExecuted: false,
    });

    const other = new InMemoryWorkflowStateStore();
    advanceToApproval(other);
    const unsafe = other.apply(
      transition('completed', 'approval_rejected', 3, {
        occurredAt: T1,
        sideEffectExecuted: true,
      }),
    );
    expect(unsafe.code).toBe('SIDE_EFFECT_UNSAFE');
  });

  it('makes expiry authoritative once the 72-hour window closes', () => {
    const store = new InMemoryWorkflowStateStore();
    advanceToApproval(store);

    const late = store.apply(
      transition('running', 'approval_granted', 3, {
        occurredAt: EXPIRES,
        actor: 'candidate',
      }),
    );
    expect(late.code).toBe('APPROVAL_WINDOW_EXPIRED');

    const early = store.apply(
      transition('requires_user_input', 'approval_window_expired', 3, {
        occurredAt: T1,
        userInputRequestId: 'input-1',
      }),
    );
    expect(early.code).toBe('APPROVAL_WINDOW_OPEN');

    const missingInputRequest = store.apply(
      transition('requires_user_input', 'approval_window_expired', 3, {
        occurredAt: EXPIRES,
      }),
    );
    expect(missingInputRequest.code).toBe('INPUT_REQUEST_REQUIRED');

    const expired = store.apply(
      transition('requires_user_input', 'approval_window_expired', 3, {
        occurredAt: EXPIRES,
        userInputRequestId: 'input-1',
      }),
    );
    expect(expired.status).toBe('applied');
    expect(expired.snapshot).toMatchObject({
      state: 'requires_user_input',
      userInputRequestId: 'input-1',
      approvalExpiresAt: null,
    });

    const wrongInput = store.apply(
      transition('running', 'input_supplied', 4, {
        occurredAt: EXPIRES,
        inputRequestId: 'wrong',
      }),
    );
    expect(wrongInput.code).toBe('INPUT_REQUEST_MISMATCH');

    const supplied = store.apply(
      transition('running', 'input_supplied', 4, {
        occurredAt: EXPIRES,
        inputRequestId: 'input-1',
      }),
    );
    expect(supplied.status).toBe('applied');
    expect(supplied.snapshot).toMatchObject({
      state: 'running',
      userInputRequestId: null,
    });
  });

  it('returns the approval decision itself only while the window is open', () => {
    const store = new InMemoryWorkflowStateStore();
    advanceToApproval(store);
    const snapshot = store.get(TASK_ID)!;

    expect(
      resolveApprovalDecision(
        snapshot,
        {
          decision: 'approved',
          candidateId: CANDIDATE_ID,
          eventId: 'decision-1',
          occurredAt: T1,
        },
        T1,
      ).decision,
    ).toBe('approved');
    expect(
      resolveApprovalDecision(
        snapshot,
        {
          decision: 'rejected',
          candidateId: CANDIDATE_ID,
          eventId: 'decision-2',
          occurredAt: EXPIRES,
        },
        EXPIRES,
      ).decision,
    ).toBe('expired');
    expect(
      resolveApprovalDecision(
        snapshot,
        {
          decision: 'approved',
          candidateId: '00000000-0000-4000-8000-000000000002',
          eventId: 'decision-3',
          occurredAt: T1,
        },
        T1,
      ).decision,
    ).toBe('invalid');
  });

  it('is idempotent across duplicate approval clicks and detects stale versions', () => {
    const store = new InMemoryWorkflowStateStore();
    advanceToApproval(store);

    const request = transition('running', 'approval_granted', 3, {
      eventId: 'approval-click-1',
      stepName: 'wait-for-approval',
      occurredAt: T1,
      actor: 'candidate',
      resolutionId: 'resolution-1',
    });

    const first = store.apply(request);
    const duplicate = store.apply({ ...request, occurredAt: '2026-01-01T03:00:00.000Z' });

    expect(first.status).toBe('applied');
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.record?.auditHash).toBe(first.record?.auditHash);
    expect(store.history(TASK_ID)).toHaveLength(4);

    const conflict = store.apply(
      transition('completed', 'step_succeeded', 3, {
        eventId: 'approval-click-2',
        outcome: 'succeeded',
      }),
    );
    expect(conflict.status).toBe('conflict');
  });

  it('caps retries at three attempts without duplicating side effects', () => {
    const store = new InMemoryWorkflowStateStore();
    enqueue(store);
    store.apply(transition('running', 'worker_acquired', 1));

    const failed = store.apply(transition('failed', 'retries_exhausted', 2));
    expect(failed.snapshot).toMatchObject({ state: 'failed', attempt: 1 });

    expect(store.apply(transition('planned', 'manual_retry', 3, { eventId: 'retry-2' })).snapshot?.attempt).toBe(2);
    store.apply(transition('running', 'worker_acquired', 4, { eventId: 'restart-2' }));
    store.apply(transition('failed', 'retries_exhausted', 5, { eventId: 'fail-2' }));

    expect(store.apply(transition('planned', 'manual_retry', 6, { eventId: 'retry-3' })).snapshot?.attempt).toBe(3);
    store.apply(transition('running', 'worker_acquired', 7, { eventId: 'restart-3' }));
    const thirdFailure = store.apply(
      transition('failed', 'retries_exhausted', 8, { eventId: 'fail-3' }),
    );
    expect(thirdFailure.snapshot?.attempt).toBe(MAX_WORKFLOW_ATTEMPTS);

    const exhausted = store.apply(
      transition('planned', 'manual_retry', 9, { eventId: 'retry-4' }),
    );
    expect(exhausted.code).toBe('ATTEMPT_LIMIT');
  });

  it('refuses a manual retry after a side effect was recorded', () => {
    const store = new InMemoryWorkflowStateStore();
    enqueue(store);
    store.apply(transition('running', 'worker_acquired', 1, { eventId: 'run-1' }));

    const failed = store.apply(
      transition('failed', 'retries_exhausted', 2, {
        eventId: 'fail-after-side-effect',
        sideEffectExecuted: true,
      }),
    );
    expect(failed.status).toBe('applied');
    expect(failed.snapshot).toMatchObject({
      state: 'failed',
      sideEffectExecuted: true,
      approvalGranted: false,
    });

    const retry = store.apply(
      transition('planned', 'manual_retry', 3, { eventId: 'retry-after-side-effect' }),
    );
    expect(retry.code).toBe('SIDE_EFFECT_UNSAFE');
    expect(retry.snapshot).toMatchObject({
      state: 'failed',
      attempt: 1,
      sideEffectExecuted: true,
    });
  });

  it('rejects illegal edges and wrong reasons with distinct codes', () => {
    const store = new InMemoryWorkflowStateStore();
    enqueue(store);

    expect(store.apply(transition('completed', 'step_succeeded', 1)).code).toBe(
      'ILLEGAL_TRANSITION',
    );
    expect(store.apply(transition('running', 'step_succeeded', 1)).code).toBe('REASON_MISMATCH');
    expect(store.apply(transition('running', 'worker_acquired', 9)).status).toBe('conflict');
  });

  it('detects audit tampering, deletion and chain corruption', () => {
    const store = new InMemoryWorkflowStateStore();
    advanceToApproval(store);
    const history = [...store.history(TASK_ID)];

    expect(verifyWorkflowAuditChain(history).valid).toBe(true);

    const tampered = history.map((record, index) =>
      index === 1 ? { ...record, actor: 'candidate' as const } : record,
    );
    expect(verifyWorkflowAuditChain(tampered).valid).toBe(false);

    const deleted = [history[0], history[2]];
    expect(verifyWorkflowAuditChain(deleted).valid).toBe(false);
  });
});
