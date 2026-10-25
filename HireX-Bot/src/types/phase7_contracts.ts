/**
 * Phase 7 frozen contracts (PHASE7_CONTRACT.md, Build Plan Phase 7).
 *
 * Scope: Mode A/B/C simulation, 8-factor difficulty lock, Piston-anchored
 * grading, baseline delta, BHASHINI bridge, offline continuity, emergency
 * invite override, and Screens 3.2/3.3. This file is write-frozen for the
 * Phase 7 coding wave.
 */

export const PHASE7_CONTRACT_VERSION = 'phase7.simulation-ide.v1' as const;
export const PHASE7_QC_PIPELINE_VERSION_REF = 'phase6.qc.v1' as const;
export const PHASE7_LATENCY_THRESHOLD_MS = 2500 as const;
export const PHASE7_PISTON_CORRECTNESS_CAP = 2.0 as const;
export const PHASE7_SIMULATION_FOCUS_BAR_HEIGHT_PX = 36 as const;
export const PHASE7_SIMULATION_LEFT_PANE_PCT = 38 as const;
export const PHASE7_SIMULATION_RIGHT_PANE_PCT = 62 as const;
export const PHASE7_ENGLISH_PITCH_TARGET_SECONDS = 60 as const;
export const PHASE7_MAX_REGENERATIONS_REF = 3 as const;

export type CalibrationMode = 'Mode_A' | 'Mode_B' | 'Mode_C';

export type DifficultyFactor =
  | 'concept_complexity'
  | 'problem_solving_depth'
  | 'edge_case_density'
  | 'specification_ambiguity'
  | 'time_pressure'
  | 'follow_up_depth'
  | 'independence'
  | 'expected_completeness';

export type DifficultyVector = Readonly<Record<DifficultyFactor, number>>;

export interface ModeExecutionPolicy {
  readonly mode: CalibrationMode;
  readonly hints_allowed: boolean;
  readonly vernacular_allowed: boolean;
  readonly time_limit_seconds: number | null;
  readonly proctored: boolean;
  readonly replay_required: boolean;
  readonly offline_allowed: boolean;
  readonly difficulty_locked_to_blueprint: boolean;
}

export const MODE_EXECUTION_POLICIES: Readonly<Record<CalibrationMode, ModeExecutionPolicy>> = {
  Mode_A: { mode: 'Mode_A', hints_allowed: true, vernacular_allowed: true, time_limit_seconds: null, proctored: false, replay_required: false, offline_allowed: true, difficulty_locked_to_blueprint: false },
  Mode_B: { mode: 'Mode_B', hints_allowed: false, vernacular_allowed: false, time_limit_seconds: null, proctored: false, replay_required: false, offline_allowed: true, difficulty_locked_to_blueprint: true },
  Mode_C: { mode: 'Mode_C', hints_allowed: false, vernacular_allowed: false, time_limit_seconds: null, proctored: true, replay_required: true, offline_allowed: true, difficulty_locked_to_blueprint: true },
} as const;

export interface ModeConfig {
  readonly mode: CalibrationMode;
  readonly sampled_topic: string;
  readonly difficulty_vector: DifficultyVector;
  readonly difficulty_locked_to_blueprint: boolean;
  readonly hints_allowed: boolean;
  readonly vernacular_allowed: boolean;
  readonly proctored: boolean;
  readonly replay_required: boolean;
  readonly is_first_attempt_unassisted: boolean;
}
export type BhashiniLanguage = 'ta' | 'hi' | 'te' | 'kn' | 'bn' | 'mr' | 'en';

export interface BhashiniTurn {
  readonly source_lang: BhashiniLanguage;
  readonly target_lang: BhashiniLanguage;
  readonly original_text: string;
  readonly translated_text: string;
  readonly asr_confidence: number | null;
}

export interface VernacularBridgeCard {
  readonly native_reasoning_turns: readonly BhashiniTurn[];
  readonly english_pitch_text: string;
  readonly pitch_duration_target_seconds: 60;
}

export type ReplayEventType = 'keystroke_delta' | 'piston_run' | 'socratic_turn' | 'rubric_eval';

export interface LiveAgentReplayEvent {
  readonly event_type: ReplayEventType;
  readonly session_id: string;
  readonly candidate_id: string;
  readonly occurred_at: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ComparableSessionKey {
  readonly candidate_id: string;
  readonly company_name: string;
  readonly job_role: string;
  readonly round_type: string;
}

export interface BaselineDeltaResult {
  readonly comparable_key: ComparableSessionKey;
  readonly baseline_score: number | null;
  readonly latest_score: number;
  readonly delta: number | null;
  readonly baseline_session_id: string | null;
  readonly comparable: boolean;
}

export type RubricCriterion =
  | 'correctness'
  | 'efficiency'
  | 'code_quality'
  | 'communication'
  | 'edge_case_handling';

export interface CriterionScore {
  readonly criterion: RubricCriterion;
  readonly score: number;
  readonly evidence_md: string;
}

export interface GradingResult {
  readonly session_id: string;
  readonly criteria: readonly CriterionScore[];
  readonly weighted_score: number | null;
  readonly piston_hidden_tests_passed: number;
  readonly piston_hidden_tests_total: number;
  readonly correctness_capped: boolean;
  readonly llm_available: boolean;
  readonly graded: boolean;
  readonly grader_model: string;
  readonly graded_at: string;
}

export interface DifficultyLock {
  readonly locked: boolean;
  readonly blueprint_id: string;
  readonly difficulty_vector: DifficultyVector;
  readonly anti_inflation: true;
}

export interface EmergencyOverrideState {
  readonly active: boolean;
  readonly priority: 1;
  readonly confirmed_company: string;
  readonly confirmed_role: string;
  readonly confirmed_round: string;
  readonly deadline_iso: string;
  readonly backcalculated_hours: number;
  readonly routine_paused: boolean;
  readonly blueprint_id: string | null;
}

export type OfflineSyncStatus = 'online' | 'degraded' | 'offline' | 'syncing' | 'synced' | 'sync_failed';

export interface OfflineQueueEntry {
  readonly entry_id: string;
  readonly session_id: string;
  readonly candidate_id: string;
  readonly queued_at: string;
  readonly payload_type: 'keystroke' | 'piston_run' | 'session_complete';
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OfflineContinuityState {
  readonly status: OfflineSyncStatus;
  readonly latency_ms: number | null;
  readonly queue_depth: number;
  readonly last_synced_at: string | null;
}

export interface PracticeSessionRecord {
  readonly id: string;
  readonly candidate_id: string;
  readonly blueprint_id: string;
  readonly blueprint_version: string;
  readonly company_name: string;
  readonly job_role: string;
  readonly round_type: string;
  readonly calibration_mode: CalibrationMode;
  readonly difficulty_vector: DifficultyVector;
  readonly weighted_score: number | null;
  readonly baseline_delta: number;
  readonly session_number: number;
  readonly rubric_version_id: string;
  readonly merkle_root_hash: string | null;
  readonly replay_jsonl_url: string | null;
  readonly trustmodel_cert_url: string | null;
  readonly created_at: string;
}

export interface SessionResponseRecord {
  readonly id: string;
  readonly session_id: string;
  readonly question_index: number;
  readonly question_prompt: string;
  readonly candidate_code_or_text: string;
  readonly language_used: string;
  readonly duration_seconds: number;
  readonly hints_used_count: number;
  readonly independent_first_attempt: boolean;
  readonly criterion_scores: readonly CriterionScore[];
  readonly evidence_feedback_md: string;
  readonly topic_tags: readonly string[];
  readonly created_at: string;
}

export interface CandidateSkillHistoryRecord {
  readonly id: string;
  readonly candidate_id: string;
  readonly session_id: string;
  readonly response_id: string | null;
  readonly topic_or_criterion: string;
  readonly round_type: string;
  readonly score_five_scale: number;
  readonly normalized_score: number;
  readonly rolling_confidence: number;
  readonly is_first_attempt_unassisted: boolean;
  readonly is_recurring_weakness: boolean;
  readonly next_recommended_action: string;
  readonly recorded_at: string;
}

export const CANDIDATE_CODE_UNTRUSTED_SOURCE = 'candidate_code' as const;
