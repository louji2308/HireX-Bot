/**
 * Phase 3 frozen contracts (Build Plan Step 3.2 arbitration / AGENTS §8.2).
 *
 * Scope:
 *  - six-state durable workflow machine
 *  - eight-event trigger catalog + two resolution signals
 *  - five-tab navigation model and chrome modes
 *  - honest pulse-strip and provenance shapes
 *
 * This file is write-frozen for implementation workers. Changes require an
 * evidence-backed contract amendment.
 */

export const PHASE3_WORKFLOW_CONTRACT_VERSION = 'phase3.workflow.v1' as const;
export const PHASE3_NAVIGATION_CONTRACT_VERSION = 'phase3.navigation.v1' as const;

/* ------------------------------------------------------------------ */
/* Workflow states                                                     */
/* ------------------------------------------------------------------ */

export const WORKFLOW_STATES = [
  'planned',
  'running',
  'awaiting_approval',
  'requires_user_input',
  'completed',
  'failed',
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const WORKFLOW_OUTCOMES = ['succeeded', 'cancelled'] as const;
export type WorkflowOutcome = (typeof WORKFLOW_OUTCOMES)[number];

export const WORKFLOW_REASONS = [
  'task_enqueued',
  'worker_acquired',
  'approval_required',
  'user_input_required',
  'approval_granted',
  'approval_rejected',
  'approval_window_expired',
  'input_supplied',
  'step_succeeded',
  'retries_exhausted',
  'manual_retry',
] as const;

export type WorkflowReason = (typeof WORKFLOW_REASONS)[number];

export const WORKFLOW_ACTORS = ['orchestrator', 'worker', 'candidate', 'operator'] as const;
export type WorkflowActor = (typeof WORKFLOW_ACTORS)[number];

export const APPROVAL_TIMEOUT_HOURS = 72 as const;
export const APPROVAL_TIMEOUT_MS = APPROVAL_TIMEOUT_HOURS * 60 * 60 * 1000;
export const USER_INPUT_TIMEOUT = '30d' as const;
export const MAX_WORKFLOW_ATTEMPTS = 3 as const;

export interface WorkflowTransitionEdge {
  readonly from: WorkflowState | null;
  readonly to: WorkflowState;
  readonly reason: WorkflowReason;
  readonly outcome: WorkflowOutcome | null;
}

/**
 * The complete legal edge set. Every other (from, to, reason) triple is
 * rejected, including terminal-state regressions.
 */
export const WORKFLOW_TRANSITION_EDGES: readonly WorkflowTransitionEdge[] = [
  { from: null, to: 'planned', reason: 'task_enqueued', outcome: null },
  { from: 'planned', to: 'running', reason: 'worker_acquired', outcome: null },
  { from: 'running', to: 'awaiting_approval', reason: 'approval_required', outcome: null },
  { from: 'running', to: 'requires_user_input', reason: 'user_input_required', outcome: null },
  { from: 'running', to: 'completed', reason: 'step_succeeded', outcome: 'succeeded' },
  { from: 'running', to: 'failed', reason: 'retries_exhausted', outcome: null },
  { from: 'awaiting_approval', to: 'running', reason: 'approval_granted', outcome: null },
  { from: 'awaiting_approval', to: 'completed', reason: 'approval_rejected', outcome: 'cancelled' },
  {
    from: 'awaiting_approval',
    to: 'requires_user_input',
    reason: 'approval_window_expired',
    outcome: null,
  },
  { from: 'requires_user_input', to: 'running', reason: 'input_supplied', outcome: null },
  { from: 'failed', to: 'planned', reason: 'manual_retry', outcome: null },
] as const;

export interface WorkflowTaskSnapshot {
  readonly taskId: string;
  readonly candidateId: string;
  readonly state: WorkflowState;
  readonly outcome: WorkflowOutcome | null;
  readonly version: number;
  readonly attempt: number;
  readonly updatedAt: string;
  readonly approvalExpiresAt: string | null;
  readonly userInputRequestId: string | null;
  readonly sideEffectExecuted: boolean;
  /**
   * True only after this task transitioned through `approval_granted`.
   * A side-effecting completion is rejected unless this is true.
   */
  readonly approvalGranted: boolean;
}

export interface WorkflowTransitionRequest {
  readonly taskId: string;
  readonly candidateId: string;
  readonly to: WorkflowState;
  readonly reason: WorkflowReason;
  /** The version the caller rendered. Must equal the current version. */
  readonly expectedVersion: number;
  /** Stable id for the decision, reused across duplicate clicks. */
  readonly eventId: string;
  /** Stable step name, reused across retries. */
  readonly stepName: string;
  readonly actor: WorkflowActor;
  readonly occurredAt: string;
  readonly outcome?: WorkflowOutcome;
  readonly sideEffectExecuted?: boolean;
  readonly approvalExpiresAt?: string;
  readonly userInputRequestId?: string;
  readonly inputRequestId?: string;
  readonly resolutionId?: string;
}

export interface WorkflowAuditRecord {
  readonly seq: number;
  readonly taskId: string;
  readonly candidateId: string;
  readonly fromState: WorkflowState | null;
  readonly toState: WorkflowState;
  readonly reason: WorkflowReason;
  readonly outcome: WorkflowOutcome | null;
  readonly sideEffectExecuted: boolean;
  readonly actor: WorkflowActor;
  readonly occurredAt: string;
  readonly eventId: string;
  readonly stepName: string;
  readonly resolutionId: string | null;
  readonly idempotencyKey: string;
  readonly prevHash: string;
  readonly auditHash: string;
}

export type WorkflowTransitionStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';

export type WorkflowRejectionCode =
  | 'INVALID_INPUT'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_EXISTS'
  | 'ILLEGAL_TRANSITION'
  | 'REASON_MISMATCH'
  | 'APPROVAL_EXPIRY_REQUIRED'
  | 'APPROVAL_WINDOW_OPEN'
  | 'APPROVAL_WINDOW_EXPIRED'
  | 'INPUT_REQUEST_REQUIRED'
  | 'INPUT_REQUEST_MISMATCH'
  | 'SIDE_EFFECT_UNSAFE'
  | 'APPROVAL_REQUIRED_FOR_SIDE_EFFECT'
  | 'ATTEMPT_LIMIT';

export interface WorkflowTransitionResult {
  readonly status: WorkflowTransitionStatus;
  readonly snapshot: WorkflowTaskSnapshot | null;
  readonly record: WorkflowAuditRecord | null;
  readonly code?: WorkflowRejectionCode;
}

export interface WorkflowStateStore {
  /** False until an approved durable adapter exists. Never claim durability. */
  readonly durable: boolean;
  get(taskId: string): WorkflowTaskSnapshot | null;
  history(taskId: string): readonly WorkflowAuditRecord[];
  apply(request: WorkflowTransitionRequest): WorkflowTransitionResult;
}

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalResolution {
  readonly decision: ApprovalDecision | 'expired' | 'invalid';
  readonly candidateId: string;
  readonly eventId: string;
  readonly occurredAt: string;
}

export interface DurableStepLike {
  waitForEvent(
    id: string,
    options: {
      event: string;
      timeout: string;
      match?: string;
      if?: string;
    },
  ): Promise<{ data?: unknown } | null>;
}

/* ------------------------------------------------------------------ */
/* Event catalog                                                       */
/* ------------------------------------------------------------------ */

export const HIREX_BOT_EVENT_NAMES = [
  'candidate/onboarding.completed',
  'job/discovered.batch',
  'application/state.routed',
  'application/approval.requested',
  'interview/invite.detected',
  'repo/push.verified',
  'apprenticeship/pr.merged',
  'session/completed.immutable',
] as const;

export type HireXBotEventName = (typeof HIREX_BOT_EVENT_NAMES)[number];

export const HIREX_RESOLUTION_EVENT_NAMES = [
  'application/approval.resolved',
  'user.input.supplied',
] as const;

export type HireXResolutionEventName = (typeof HIREX_RESOLUTION_EVENT_NAMES)[number];

export interface CandidateOnboardingCompletedPayload {
  candidate_id: string;
  college_tier: 'Tier_1' | 'Tier_2' | 'Tier_3' | 'Rural';
  target_roles: string[];
  preferred_language: 'ta' | 'hi' | 'te' | 'kn' | 'bn' | 'mr' | 'en';
  autonomy_level: 1 | 2 | 3 | 4;
}

export interface DiscoveredJobPayload {
  job_url: string;
  company: string;
  title: string;
  raw_md_url: string;
  source: string;
}

export interface JobDiscoveredBatchPayload {
  candidate_id: string;
  jobs: DiscoveredJobPayload[];
}

export interface ApplicationStateRoutedPayload {
  candidate_id: string;
  event_id: string;
  decision_state: 'State_1' | 'State_2' | 'State_3' | 'State_4';
  missing_preferred_skills: string[];
  missing_core_skills: string[];
}

export interface ApplicationApprovalRequestedPayload {
  candidate_id: string;
  event_id: string;
  tailored_pdf_url: string;
  micro_deliverable_url: string;
  passport_url: string;
}

export interface InterviewInviteDetectedPayload {
  candidate_id: string;
  company_name: string;
  job_role: string;
  confirmed_round_type: string;
  deadline_iso: string;
  invite_text: string;
}

export interface RepoPushVerifiedPayload {
  candidate_id: string;
  artifact_id: string;
  repo_url: string;
  commit_sha: string;
  sprint_ticket_ids: string[];
}

export interface ApprenticeshipPrMergedPayload {
  candidate_id: string;
  sprint_id: string;
  repo_name: string;
  pr_url: string;
  merged_at_iso: string;
}

export interface SessionCompletedImmutablePayload {
  candidate_id: string;
  session_id: string;
  round_type: string;
  calibration_mode: string;
  weighted_score: number;
  baseline_delta: number;
}

export interface HireXBotEventPayloads {
  'candidate/onboarding.completed': CandidateOnboardingCompletedPayload;
  'job/discovered.batch': JobDiscoveredBatchPayload;
  'application/state.routed': ApplicationStateRoutedPayload;
  'application/approval.requested': ApplicationApprovalRequestedPayload;
  'interview/invite.detected': InterviewInviteDetectedPayload;
  'repo/push.verified': RepoPushVerifiedPayload;
  'apprenticeship/pr.merged': ApprenticeshipPrMergedPayload;
  'session/completed.immutable': SessionCompletedImmutablePayload;
}

export interface ApplicationApprovalResolvedPayload {
  taskId: string;
  candidateId: string;
  decision: ApprovalDecision;
  eventId: string;
  resolvedAt: string;
}

export interface UserInputSuppliedPayload {
  taskId: string;
  candidateId: string;
  inputRequestId: string;
  suppliedAt: string;
}

export interface HireXBotResolutionPayloads {
  'application/approval.resolved': ApplicationApprovalResolvedPayload;
  'user.input.supplied': UserInputSuppliedPayload;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_TAB_IDS = [
  'command',
  'opportunities',
  'studio',
  'proof',
  'passport',
] as const;

export type NavTabId = (typeof NAV_TAB_IDS)[number];

export interface NavTabDefinition {
  readonly id: NavTabId;
  readonly label: string;
  readonly href: string;
  readonly module: string;
}

export const NAV_TABS: readonly NavTabDefinition[] = [
  { id: 'command', label: 'Command', href: '/dashboard', module: 'Module 8' },
  { id: 'opportunities', label: 'Opportunities', href: '/opportunities', module: 'Modules 4 & 7' },
  { id: 'studio', label: 'Studio', href: '/interview', module: 'Module 5' },
  { id: 'proof', label: 'Proof', href: '/proof', module: 'Modules 2 & 3' },
  { id: 'passport', label: 'Passport', href: '/passport-vault', module: 'Modules 6 & 1' },
] as const;

export type WorkspaceChrome = 'workspace' | 'focus' | 'hidden';

export interface NavResolution {
  readonly chrome: WorkspaceChrome;
  readonly activeTabId: NavTabId | null;
  readonly normalizedPath: string;
  readonly isSessionRoute: boolean;
}

/* ------------------------------------------------------------------ */
/* Pulse strip and provenance                                          */
/* ------------------------------------------------------------------ */

export type PulseLaneId = 'discovery' | 'application' | 'training' | 'local';
export type PulseLaneState = WorkflowState | 'not_started' | 'unavailable';
export type PulseSource = 'inngest' | 'supabase' | 'local' | 'none';

export interface PulseLaneSnapshot {
  readonly lane: PulseLaneId;
  readonly state: PulseLaneState;
  readonly summary: string;
  /** null means "not measured"; never render it as 0. */
  readonly count: number | null;
  readonly observedAt: string | null;
  readonly source: PulseSource;
}

export type ProvenanceSource = 'static' | 'runtime' | 'unavailable';

export interface ProvenanceEntry {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly source: ProvenanceSource;
  readonly observedAt: string | null;
}
