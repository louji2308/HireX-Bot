import {
  WORKFLOW_AUDIT_GENESIS_HASH,
  computeWorkflowAuditHash,
} from '@/inngest/audit';
import { findWorkflowTransitionEdge } from '@/inngest/state-machine';
import {
  MAX_WORKFLOW_ATTEMPTS,
  WORKFLOW_ACTORS,
  WORKFLOW_REASONS,
  WORKFLOW_STATES,
  WORKFLOW_TRANSITION_EDGES,
  type WorkflowAuditRecord,
  type WorkflowRejectionCode,
  type WorkflowStateStore,
  type WorkflowTaskSnapshot,
  type WorkflowTransitionRequest,
  type WorkflowTransitionResult,
} from '@/types/phase3_contracts';

export function buildWorkflowIdempotencyKey(request: WorkflowTransitionRequest): string {
  return JSON.stringify([
    request.taskId,
    request.eventId,
    request.stepName,
    request.to,
    request.reason,
    request.resolutionId ?? null,
  ]);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function rejection(
  code: WorkflowRejectionCode,
  snapshot: WorkflowTaskSnapshot | null = null,
): WorkflowTransitionResult {
  return { status: 'rejected', snapshot, record: null, code };
}

function cloneSnapshot(snapshot: WorkflowTaskSnapshot): WorkflowTaskSnapshot {
  return Object.freeze({ ...snapshot });
}

function cloneRecord(record: WorkflowAuditRecord): WorkflowAuditRecord {
  return Object.freeze({ ...record });
}

/**
 * Contract-first, in-memory store. This is deliberately not durable and must
 * not be presented as a production workflow ledger. A future DB-backed adapter
 * must preserve the same transition and audit semantics.
 */
export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  readonly durable = false;

  private readonly tasks = new Map<string, WorkflowTaskSnapshot>();
  private readonly auditHistory = new Map<string, WorkflowAuditRecord[]>();
  private readonly idempotencyIndex = new Map<string, WorkflowAuditRecord>();

  get(taskId: string): WorkflowTaskSnapshot | null {
    const snapshot = this.tasks.get(taskId);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  history(taskId: string): readonly WorkflowAuditRecord[] {
    return (this.auditHistory.get(taskId) ?? []).map(cloneRecord);
  }

  apply(request: WorkflowTransitionRequest): WorkflowTransitionResult {
    if (
      !hasText(request.taskId) ||
      !hasText(request.candidateId) ||
      !hasText(request.eventId) ||
      !hasText(request.stepName) ||
      !WORKFLOW_STATES.includes(request.to) ||
      !WORKFLOW_REASONS.includes(request.reason) ||
      !WORKFLOW_ACTORS.includes(request.actor) ||
      !isValidTimestamp(request.occurredAt) ||
      !Number.isInteger(request.expectedVersion) ||
      request.expectedVersion < 0
    ) {
      return rejection('INVALID_INPUT', this.get(request.taskId));
    }

    const current = this.tasks.get(request.taskId) ?? null;
    const idempotencyKey = buildWorkflowIdempotencyKey(request);
    const existing = this.idempotencyIndex.get(idempotencyKey);

    if (existing) {
      return {
        status: 'duplicate',
        snapshot: current ? cloneSnapshot(current) : null,
        record: cloneRecord(existing),
      };
    }

    if (!current) {
      if (request.to !== 'planned' || request.reason !== 'task_enqueued') {
        return rejection('TASK_NOT_FOUND');
      }

      if (request.expectedVersion !== 0) {
        return { status: 'conflict', snapshot: null, record: null };
      }

      const edge = findWorkflowTransitionEdge(null, 'planned', 'task_enqueued');
      if (!edge) {
        return rejection('ILLEGAL_TRANSITION');
      }

      const snapshot: WorkflowTaskSnapshot = {
        taskId: request.taskId,
        candidateId: request.candidateId,
        state: 'planned',
        outcome: null,
        version: 1,
        attempt: 1,
        updatedAt: request.occurredAt,
        approvalExpiresAt: null,
        userInputRequestId: null,
        sideEffectExecuted: false,
      };

      return this.commit(snapshot, request, null, idempotencyKey);
    }

    if (current.candidateId !== request.candidateId) {
      return rejection('INVALID_INPUT', cloneSnapshot(current));
    }

    if (request.expectedVersion !== current.version) {
      return { status: 'conflict', snapshot: cloneSnapshot(current), record: null };
    }

    if (request.to === 'planned' && request.reason === 'task_enqueued') {
      return rejection('TASK_ALREADY_EXISTS', cloneSnapshot(current));
    }

    const edge = findWorkflowTransitionEdge(current.state, request.to, request.reason);

    if (!edge) {
      const statePairExists = WORKFLOW_TRANSITION_EDGES.some(
        (candidate) => candidate.from === current.state && candidate.to === request.to,
      );
      const code: WorkflowRejectionCode = statePairExists
        ? 'REASON_MISMATCH'
        : 'ILLEGAL_TRANSITION';
      return rejection(code, cloneSnapshot(current));
    }

    const occurredAtMs = Date.parse(request.occurredAt);
    const approvalExpiryMs = current.approvalExpiresAt
      ? Date.parse(current.approvalExpiresAt)
      : Number.NaN;
    const nextApprovalExpiryMs = request.approvalExpiresAt
      ? Date.parse(request.approvalExpiresAt)
      : Number.NaN;

    if (request.reason === 'approval_required') {
      if (
        !request.approvalExpiresAt ||
        Number.isNaN(nextApprovalExpiryMs) ||
        nextApprovalExpiryMs <= occurredAtMs
      ) {
        return rejection('APPROVAL_EXPIRY_REQUIRED', cloneSnapshot(current));
      }
    }

    if (
      (request.reason === 'approval_granted' || request.reason === 'approval_rejected') &&
      (Number.isNaN(approvalExpiryMs) || occurredAtMs >= approvalExpiryMs)
    ) {
      return rejection('APPROVAL_WINDOW_EXPIRED', cloneSnapshot(current));
    }

    if (request.reason === 'approval_window_expired') {
      if (Number.isNaN(approvalExpiryMs) || occurredAtMs < approvalExpiryMs) {
        return rejection('APPROVAL_WINDOW_OPEN', cloneSnapshot(current));
      }
    }

    if (request.reason === 'approval_rejected') {
      if (current.sideEffectExecuted || request.sideEffectExecuted === true) {
        return rejection('SIDE_EFFECT_UNSAFE', cloneSnapshot(current));
      }
    }

    if (request.reason === 'input_supplied') {
      if (!current.userInputRequestId) {
        return rejection('INPUT_REQUEST_REQUIRED', cloneSnapshot(current));
      }

      if (request.inputRequestId !== current.userInputRequestId) {
        return rejection('INPUT_REQUEST_MISMATCH', cloneSnapshot(current));
      }
    }

    if (request.reason === 'manual_retry' && current.attempt >= MAX_WORKFLOW_ATTEMPTS) {
      return rejection('ATTEMPT_LIMIT', cloneSnapshot(current));
    }

    if (
      edge.outcome !== null &&
      request.outcome !== undefined &&
      request.outcome !== edge.outcome
    ) {
      return rejection('INVALID_INPUT', cloneSnapshot(current));
    }

    const nextOutcome = edge.outcome ?? null;

    if (nextOutcome === 'cancelled' && request.sideEffectExecuted === true) {
      return rejection('SIDE_EFFECT_UNSAFE', cloneSnapshot(current));
    }

    let approvalExpiresAt = current.approvalExpiresAt;
    let userInputRequestId = current.userInputRequestId;
    let sideEffectExecuted = current.sideEffectExecuted;
    let attempt = current.attempt;

    switch (request.to) {
      case 'planned':
        attempt = current.attempt + 1;
        approvalExpiresAt = null;
        userInputRequestId = null;
        sideEffectExecuted = false;
        break;
      case 'running':
        approvalExpiresAt = null;
        userInputRequestId = null;
        break;
      case 'awaiting_approval':
        approvalExpiresAt = request.approvalExpiresAt ?? null;
        userInputRequestId = null;
        sideEffectExecuted = false;
        break;
      case 'requires_user_input':
        approvalExpiresAt = null;
        userInputRequestId = request.userInputRequestId ?? null;
        break;
      case 'completed':
        approvalExpiresAt = null;
        userInputRequestId = null;
        sideEffectExecuted = request.sideEffectExecuted ?? current.sideEffectExecuted;
        break;
      case 'failed':
        approvalExpiresAt = null;
        userInputRequestId = null;
        break;
    }

    const snapshot: WorkflowTaskSnapshot = {
      taskId: current.taskId,
      candidateId: current.candidateId,
      state: request.to,
      outcome: nextOutcome,
      version: current.version + 1,
      attempt,
      updatedAt: request.occurredAt,
      approvalExpiresAt,
      userInputRequestId,
      sideEffectExecuted,
    };

    return this.commit(snapshot, request, current, idempotencyKey);
  }

  private commit(
    snapshot: WorkflowTaskSnapshot,
    request: WorkflowTransitionRequest,
    previous: WorkflowTaskSnapshot | null,
    idempotencyKey: string,
  ): WorkflowTransitionResult {
    const history = this.auditHistory.get(snapshot.taskId) ?? [];
    const previousRecord = history[history.length - 1] ?? null;
    const withoutHash = {
      seq: history.length + 1,
      taskId: snapshot.taskId,
      candidateId: snapshot.candidateId,
      fromState: previous?.state ?? null,
      toState: snapshot.state,
      reason: request.reason,
      outcome: snapshot.outcome,
      sideEffectExecuted: snapshot.sideEffectExecuted,
      actor: request.actor,
      occurredAt: request.occurredAt,
      eventId: request.eventId,
      stepName: request.stepName,
      resolutionId: request.resolutionId ?? null,
      idempotencyKey,
      prevHash: previousRecord?.auditHash ?? WORKFLOW_AUDIT_GENESIS_HASH,
    };
    const record: WorkflowAuditRecord = {
      ...withoutHash,
      auditHash: computeWorkflowAuditHash(withoutHash),
    };

    this.tasks.set(snapshot.taskId, snapshot);
    const nextHistory = [...history, record];
    this.auditHistory.set(snapshot.taskId, nextHistory);
    this.idempotencyIndex.set(idempotencyKey, record);

    return {
      status: 'applied',
      snapshot: cloneSnapshot(snapshot),
      record: cloneRecord(record),
    };
  }
}
