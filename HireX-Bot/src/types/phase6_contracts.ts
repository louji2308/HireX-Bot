/**
 * Phase 6 frozen contracts (PHASE6_CONTRACT.md, Build Plan Phase 6).
 *
 * Scope: 5-tier company research, 7-input blueprint configurator, 7-stage
 * question QC pipeline, Piston Stage 5 verification, Workflow C pre-warming,
 * and Screen 3.1. This file is write-frozen for the Phase 6 coding wave.
 */

export const PHASE6_CONTRACT_VERSION = 'phase6.blueprint-qc.v1' as const;
export const PHASE6_QC_PIPELINE_VERSION = 'phase6.qc.v1' as const;
export const PHASE6_EVIDENCE_VERSION = 'phase6.evidence.v1' as const;
export const PHASE6_BLUEPRINT_VERSION_DEFAULT = 'v1.0' as const;
export const PHASE6_STAGE5_LATENCY_LIMIT_MS = 3000 as const;
export const PHASE6_MAX_REGENERATIONS = 3 as const;
export const PHASE6_MAX_HIDDEN_TESTS = 8 as const;
export const PHASE6_MAX_PROBLEM_STATEMENT_CHARS = 8000 as const;

export type CandidateLevel =
  | 'Intern'
  | 'New_Grad_Fresher'
  | 'Entry_Level_0_2Y'
  | 'Mid_Level';

export type HiringStage =
  | 'Resume_Screen'
  | 'Online_Assessment'
  | 'Recruiter_Screen'
  | 'Coding'
  | 'Technical_Fundamentals'
  | 'Project_Discussion'
  | 'Role_Specific_Practical'
  | 'System_Design'
  | 'Behavioral'
  | 'Final_HR_Offer';

export type ExpectedFormat =
  | 'live_coding'
  | 'take_home'
  | 'whiteboard'
  | 'verbal'
  | 'oa_timed';

export type ConfidenceTier =
  | 'Confirmed — Employer Supplied'
  | 'Verified — Official Documentation'
  | 'Verified — Vacancy Specification'
  | 'High-Confidence Inferred'
  | 'Company-Informed Simulation';

export type EvidenceTier = 1 | 2 | 3 | 4 | 5;

export interface CandidateCapabilityHistory {
  readonly weak_topics: readonly string[];
  readonly strong_topics: readonly string[];
  readonly completed_sessions: number;
  readonly last_weighted_score: number | null;
  readonly declared_skills: readonly string[];
}

export interface BlueprintInputs {
  readonly company: string;
  readonly job_role: string;
  readonly candidate_level: CandidateLevel;
  readonly selected_round: HiringStage;
  readonly expected_format: ExpectedFormat;
  readonly candidate_capability: CandidateCapabilityHistory;
  readonly interview_deadline: string | null;
}

export interface EvidenceSource {
  readonly tier: EvidenceTier;
  readonly label: string;
  readonly url: string;
  readonly retrieved_at: string;
  readonly content_sha256: string;
  readonly excerpt: string;
}

export interface CompanyResearch {
  readonly company: string;
  readonly confidence_tier: ConfidenceTier;
  readonly sources: readonly EvidenceSource[];
  readonly round_sequence: readonly HiringStage[];
  readonly competency_weights: Readonly<Record<string, number>>;
  readonly retrieved_at: string;
  readonly source_mode: 'live_jina' | 'cached' | 'seeded';
  readonly live_verified: boolean;
}

export interface Blueprint {
  readonly id: string | null;
  readonly candidate_id: string | null;
  readonly company_name: string;
  readonly job_role: string;
  readonly candidate_level: CandidateLevel;
  readonly round_type: HiringStage;
  readonly blueprint_version: string;
  readonly evaluation_criteria_weights: Readonly<Record<string, number>>;
  readonly question_distribution: Readonly<Record<string, number>>;
  readonly duration_minutes: number;
  readonly confidence_tier: ConfidenceTier;
  readonly source_urls: readonly string[];
  readonly visibility: 'shared' | 'candidate';
  readonly inputs: BlueprintInputs;
  readonly created_at: string | null;
}

export type QCStageName =
  | 'retrieve_evidence'
  | 'construct_blueprint'
  | 'synthesize_question'
  | 'audit_competency'
  | 'piston_reference'
  | 'validate_rubric'
  | 'release';

export type QCStageStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'regenerating';

export interface QCStageResult {
  readonly stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly name: QCStageName;
  readonly status: QCStageStatus;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly detail: string;
  readonly error: string | null;
}

export interface PistonTestCase {
  readonly id: string;
  readonly input: string;
  readonly expected: string;
  readonly hidden: boolean;
}

export interface PistonRunResult {
  readonly outcome:
    | 'pass'
    | 'fail'
    | 'time_limit_exceeded'
    | 'compile_error'
    | 'runtime_error';
  readonly exit_code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly latency_ms: number;
  readonly memory_bytes: number | null;
  readonly tests_passed: number;
  readonly tests_total: number;
}

export interface Stage5Verification {
  readonly reference_run: PistonRunResult;
  readonly mutated_run: PistonRunResult;
  readonly hidden_tests: readonly PistonTestCase[];
  readonly passed: boolean;
  readonly rejection_reason: string | null;
}

export type QCFinalStatus = 'released' | 'rejected' | 'regenerating';

export interface QCPipelineResult {
  readonly bundle_id: string;
  readonly blueprint: Blueprint;
  readonly stages: readonly QCStageResult[];
  readonly stage5: Stage5Verification | null;
  readonly final_status: QCFinalStatus;
  readonly regenerated_count: number;
  readonly cached: boolean;
  readonly pre_warmed: boolean;
}

export interface PreWarmJob {
  readonly job_id: string;
  readonly trigger: 'onboarding_completed' | 'job_discovered' | 'manual';
  readonly bundle_id: string | null;
  readonly status: 'queued' | 'running' | 'completed' | 'failed';
  readonly started_at: string | null;
  readonly finished_at: string | null;
}

export interface InterviewBlueprintRow {
  readonly id: string;
  readonly candidate_id: string | null;
  readonly company_name: string;
  readonly job_role: string;
  readonly candidate_level: CandidateLevel;
  readonly round_type: HiringStage;
  readonly blueprint_version: string;
  readonly evaluation_criteria_weights: Readonly<Record<string, number>>;
  readonly question_distribution: Readonly<Record<string, number>>;
  readonly duration_minutes: number;
  readonly confidence_tier: ConfidenceTier;
  readonly source_urls: readonly string[];
  readonly visibility: 'shared' | 'candidate';
}

export const QC_STAGE_NAMES: readonly QCStageName[] = [
  'retrieve_evidence',
  'construct_blueprint',
  'synthesize_question',
  'audit_competency',
  'piston_reference',
  'validate_rubric',
  'release',
] as const;

export const SENIORITY_MAX_COMPLEXITY: Readonly<Record<CandidateLevel, number>> = {
  Intern: 1,
  New_Grad_Fresher: 2,
  Entry_Level_0_2Y: 3,
  Mid_Level: 4,
} as const;
