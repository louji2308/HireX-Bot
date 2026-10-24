/**
 * Phase 5 frozen contracts (PHASE5_CONTRACT.md, Build Plan Phase 5).
 *
 * Scope: captured public opportunity snapshots, deterministic five-dimension
 * assessment, the total four-state router, local persistence, and the triage
 * board. This file is write-frozen for the Phase 5 coding wave.
 */

export const PHASE5_CONTRACT_VERSION = 'phase5.discovery.v1' as const;
export const PHASE5_SNAPSHOT_SCHEMA_VERSION = 'phase5.snapshot.v1' as const;
export const PHASE5_ROUTER_VERSION = 'phase5.router.v1' as const;
export const PHASE5_SCORING_VERSION = 'phase5.role-fit.v1' as const;
export const PHASE5_QUALITY_RULES_VERSION = 'phase5.quality.v1' as const;

export type DecisionState = 'State_1' | 'State_2' | 'State_3' | 'State_4';
export type OpportunitySource = 'greenhouse_public' | 'ashby_public' | 'synthetic_fixture';
export type EmploymentType = 'full_time' | 'internship' | 'apprenticeship' | 'contract';
export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'flexible';
export type CanonicalLocation =
  | 'bengaluru'
  | 'hyderabad'
  | 'pune'
  | 'chennai'
  | 'delhi_ncr'
  | 'mumbai'
  | 'remote_india'
  | 'anywhere_india'
  | 'other';

export type EligibilityStatus = 'pass' | 'fail' | 'unknown';
export type EligibilityCheckStatus = 'pass' | 'fail' | 'unknown' | 'not_applicable';
export type QualityStatus = 'pass' | 'fail' | 'needs_review';
export type DimensionUnavailableReason =
  | 'source_module_absent'
  | 'no_artifacts'
  | 'no_sessions'
  | 'insufficient_listing_data';

export type CompensationKind = 'unknown' | 'monthly_stipend' | 'annual_ctc';
export type CompensationFloor =
  | 'credit_only'
  | '10k_20k_month'
  | '3_5_lpa'
  | '6_10_lpa'
  | '10_plus_lpa'
  | 'not_sure';
export type JoiningAvailability =
  | 'immediately'
  | 'two_weeks'
  | 'one_month'
  | 'three_months'
  | 'six_plus_months';

export interface CompensationRange {
  readonly kind: CompensationKind;
  readonly currency: 'INR';
  readonly min: number | null;
  readonly max: number | null;
  readonly period: 'month' | 'year' | null;
}

export interface JoiningWindow {
  readonly earliest: string | null;
  readonly latest: string | null;
}

export interface OpportunityRequirements {
  readonly core_skills: readonly string[];
  readonly preferred_skills: readonly string[];
  readonly min_experience_years: number | null;
  readonly max_experience_years: number | null;
  readonly degree_required: string | null;
  readonly graduation_years: readonly number[] | null;
}

export interface OpportunitySnapshot {
  readonly schema_version: typeof PHASE5_SNAPSHOT_SCHEMA_VERSION;
  readonly source: OpportunitySource;
  readonly source_job_id: string;
  readonly company: string;
  readonly title: string;
  readonly url: string;
  readonly locations: readonly CanonicalLocation[];
  readonly location_text: string;
  readonly work_modes: readonly WorkMode[];
  readonly employment_type: EmploymentType;
  readonly compensation: CompensationRange;
  readonly joining: JoiningWindow;
  readonly requirements: OpportunityRequirements;
  readonly captured_at: string;
  readonly source_updated_at: string | null;
  readonly published_at: string | null;
  readonly valid_through: string | null;
  readonly description_excerpt: string;
  readonly quality_excerpt: string;
  readonly capture_method: 'manual_api_capture' | 'synthetic';
  readonly synthetic: boolean;
}

export interface CandidateScoringInput {
  readonly target_roles: readonly string[];
  readonly declared_skills: readonly string[];
  readonly locations: readonly CanonicalLocation[];
  readonly work_mode: WorkMode;
  readonly employment_types: readonly EmploymentType[];
  readonly compensation_floor: CompensationFloor;
  readonly joining: JoiningAvailability;
  readonly relocation: boolean;
  readonly graduation_year: number | null;
  readonly degree: string | null;
  readonly experience_years: number;
}

export interface EligibilityCheck {
  readonly id: string;
  readonly label: string;
  readonly status: EligibilityCheckStatus;
  readonly hard: boolean;
  readonly detail: string;
}

export interface EligibilityResult {
  readonly status: EligibilityStatus;
  readonly checks: readonly EligibilityCheck[];
  readonly warnings: readonly string[];
}

export interface RoleFitResult {
  readonly status: 'assessed';
  readonly value: number;
  readonly method: typeof PHASE5_SCORING_VERSION;
  readonly label: 'Declared skill overlap; not verified';
  readonly core_matched: readonly string[];
  readonly core_missing: readonly string[];
  readonly preferred_matched: readonly string[];
  readonly preferred_missing: readonly string[];
}

export interface NotAssessedDimension {
  readonly status: 'not_assessed';
  readonly value: null;
  readonly reason: DimensionUnavailableReason;
  readonly detail: string;
}

export interface MeasuredDimension {
  readonly status: 'assessed';
  readonly value: number;
  readonly method: string;
  readonly label: string;
}

export type DimensionScore = NotAssessedDimension | MeasuredDimension;

export interface OpportunityQualityFinding {
  readonly rule_id: string;
  readonly severity: 'medium' | 'high';
  readonly label: string;
  readonly quote: string;
}

export interface OpportunityQualityResult {
  readonly status: QualityStatus;
  readonly rules_version: typeof PHASE5_QUALITY_RULES_VERSION;
  readonly scanned_chars: number;
  readonly findings: readonly OpportunityQualityFinding[];
  readonly note: string;
}

export interface FitScores5D {
  readonly eligibility: EligibilityResult;
  readonly role_fit: RoleFitResult;
  readonly evidence_strength: DimensionScore;
  readonly interview_readiness: DimensionScore;
  readonly opportunity_quality: OpportunityQualityResult;
}

export type DecisionReasonCode =
  | 'eligibility_boundary'
  | 'quality_boundary'
  | 'role_fit_below_threshold'
  | 'eligibility_confirmation'
  | 'quality_review'
  | 'verified_thresholds_met'
  | 'apply_while_calibrating'
  | 'prepare_and_revisit';

export interface OpportunityDecision {
  readonly state: DecisionState;
  readonly reason_code: DecisionReasonCode;
  readonly explanation: string;
  readonly missing_core_skills: readonly string[];
  readonly missing_preferred_skills: readonly string[];
  readonly requires_confirmation: boolean;
}

export interface OpportunityProvenance {
  readonly source: OpportunitySource;
  readonly source_label: string;
  readonly source_url: string;
  readonly captured_at: string;
  readonly source_updated_at: string | null;
  readonly published_at: string | null;
  readonly valid_through: string | null;
  readonly content_sha256: string;
  readonly capture_method: OpportunitySnapshot['capture_method'];
  readonly live: false;
  readonly synthetic: boolean;
}

export interface OpportunityAssessment {
  readonly pipeline_id: string;
  readonly job: OpportunitySnapshot;
  readonly fit_scores_5d: FitScores5D;
  readonly decision: OpportunityDecision;
  readonly provenance: OpportunityProvenance;
  readonly saved: boolean;
}

export interface DedupeReport {
  readonly input_count: number;
  readonly unique_count: number;
  readonly merged_groups: readonly {
    readonly source_job_id: string;
    readonly sources: readonly OpportunitySource[];
  }[];
  readonly collisions: readonly {
    readonly key: string;
    readonly source_job_ids: readonly string[];
  }[];
}

export interface OpportunityWorkspace {
  readonly version: 1;
  readonly contractVersion: typeof PHASE5_CONTRACT_VERSION;
  readonly sessionId: string;
  readonly candidateId: string;
  readonly revision: number;
  readonly discoveredAt: string;
  readonly candidateLabel: string;
  readonly sampleCandidate: boolean;
  readonly source: 'local_intake' | 'snapshot_preview';
  readonly live: false;
  readonly jobs: readonly OpportunityAssessment[];
  readonly notices: readonly string[];
  readonly dedupe: DedupeReport;
}

export type DecisionCounts = Readonly<Record<DecisionState, number>>;

export interface OpportunityBoardResponse {
  readonly version: 1;
  readonly contractVersion: typeof PHASE5_CONTRACT_VERSION;
  readonly source: OpportunityWorkspace['source'];
  readonly candidate_label: string;
  readonly synthetic_candidate: boolean;
  readonly live: false;
  readonly durable: false;
  readonly discovered_at: string;
  readonly jobs: readonly OpportunityAssessment[];
  readonly counts: DecisionCounts;
  readonly notices: readonly string[];
  readonly dedupe: DedupeReport;
}

export interface OpportunityStore {
  /** False until a durable authenticated adapter exists. Never claim durability. */
  readonly durable: boolean;
  read(sessionId: string): Promise<OpportunityWorkspace | null>;
  write(workspace: OpportunityWorkspace): Promise<void>;
  update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: OpportunityWorkspace) => OpportunityWorkspace,
  ): Promise<OpportunityWorkspace | null>;
  erase(sessionId: string): Promise<boolean>;
}

export const DECISION_STATE_META: Readonly<
  Record<
    DecisionState,
    {
      readonly label: string;
      readonly icon: string;
      readonly description: string;
    }
  >
> = {
  State_1: {
    label: 'Apply now',
    icon: '●',
    description: 'Role fit and measured evidence both clear the publishing thresholds.',
  },
  State_2: {
    label: 'Apply while calibrating',
    icon: '◐',
    description: 'Core overlap is present; a specific gap is being closed before submission.',
  },
  State_3: {
    label: 'Prepare and revisit',
    icon: '◌',
    description: 'The role is reachable, but proof or core coverage needs to improve first.',
  },
  State_4: {
    label: 'Boundary found',
    icon: '⊘',
    description: 'A confirmed eligibility or opportunity-quality boundary applies.',
  },
} as const;

export const DECISION_STATES: readonly DecisionState[] = [
  'State_1',
  'State_2',
  'State_3',
  'State_4',
] as const;

export const PHASE5_SNAPSHOT_NOTICE =
  'Captured public job-board snapshots. Not live, not continuously ingested.' as const;
export const PHASE5_LOCAL_NOTICE =
  'Stored in the local workspace on this device. Not durable and not backed by Supabase.' as const;
export const PHASE5_SAMPLE_NOTICE =
  'Preview uses a sample candidate profile so the board is inspectable without an intake session.' as const;
