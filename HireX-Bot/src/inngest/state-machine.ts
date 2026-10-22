import { applicationApprovalResolvedSchema } from '@/inngest/events';
import {
  APPROVAL_TIMEOUT_HOURS,
  WORKFLOW_TRANSITION_EDGES,
  type ApplicationApprovalResolvedPayload,
  type ApprovalDecision,
  type ApprovalResolution,
  type DurableStepLike,
  type WorkflowReason,
  type WorkflowState,
  type WorkflowTaskSnapshot,
  type WorkflowTransitionEdge,
} from '@/types/phase3_contracts';

export function findWorkflowTransitionEdge(
  from: WorkflowState | null,
  to: WorkflowState,
  reason: WorkflowReason,
): WorkflowTransitionEdge | null {
  return (
    WORKFLOW_TRANSITION_EDGES.find(
      (edge) => edge.from === from && edge.to === to && edge.reason === reason,
    ) ?? null
  );
}

export function isWorkflowState(value: unknown): value is WorkflowState {
  return (
    value === 'planned' ||
    value === 'running' ||
    value === 'awaiting_approval' ||
    value === 'requires_user_input' ||
    value === 'completed' ||
    value === 'failed'
  );
}

export interface ApprovalDecisionResult {
  readonly decision: ApprovalDecision | 'expired' | 'invalid';
  readonly eventId: string;
  readonly occurredAt: string;
}

/**
 * A decision only applies while the approval window is open. Once the window
 * closes, the timer is authoritative even if a late click arrives.
 */
export function resolveApprovalDecision(
  snapshot: WorkflowTaskSnapshot,
  resolution: ApprovalResolution,
  now: string,
): ApprovalDecisionResult {
  if (
    snapshot.state !== 'awaiting_approval' ||
    (resolution.decision !== 'approved' && resolution.decision !== 'rejected') ||
    !resolution.eventId ||
    !resolution.occurredAt
  ) {
    return { decision: 'invalid', eventId: resolution.eventId, occurredAt: resolution.occurredAt };
  }

  const nowMs = Date.parse(now);
  const expiryMs = snapshot.approvalExpiresAt
    ? Date.parse(snapshot.approvalExpiresAt)
    : Number.NaN;

  if (Number.isNaN(nowMs) || Number.isNaN(expiryMs)) {
    return { decision: 'invalid', eventId: resolution.eventId, occurredAt: resolution.occurredAt };
  }

  if (nowMs >= expiryMs) {
    return {
      decision: 'expired',
      eventId: resolution.eventId,
      occurredAt: resolution.occurredAt,
    };
  }

  return resolution;
}

export interface ApprovalWaitResult {
  readonly resolution: ApprovalResolution;
  readonly payload: ApplicationApprovalResolvedPayload | null;
  readonly timedOut: boolean;
}

/**
 * Wait for the candidate's approval decision. A timeout is a first-class
 * resolution, not an exception, so the workflow can move to user input.
 */
export async function waitForApproval(
  step: Pick<DurableStepLike, 'waitForEvent'>,
  taskId: string,
  now: () => Date = () => new Date(),
): Promise<ApprovalWaitResult> {
  const event = await step.waitForEvent(`approval:${taskId}`, {
    event: 'application/approval.resolved',
    timeout: `${APPROVAL_TIMEOUT_HOURS}h`,
    match: 'data.taskId',
  });

  if (!event) {
    return {
      resolution: {
        decision: 'expired',
        eventId: `approval-timeout:${taskId}`,
        occurredAt: now().toISOString(),
      },
      payload: null,
      timedOut: true,
    };
  }

  const parsed = applicationApprovalResolvedSchema.safeParse(event.data);

  if (!parsed.success) {
    return {
      resolution: {
        decision: 'invalid',
        eventId: `approval-invalid:${taskId}`,
        occurredAt: now().toISOString(),
      },
      payload: null,
      timedOut: false,
    };
  }

  return {
    resolution: {
      decision: parsed.data.decision,
      eventId: parsed.data.eventId,
      occurredAt: parsed.data.resolvedAt,
    },
    payload: parsed.data,
    timedOut: false,
  };
}
