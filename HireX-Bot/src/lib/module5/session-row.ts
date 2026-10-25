import type { PracticeSessionRecord } from '@/types/phase7_contracts';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function toPracticeSessionRow(record: PracticeSessionRecord): {
  readonly id: string;
  readonly candidate_id: string;
  readonly blueprint_id: string;
  readonly blueprint_version: string;
  readonly company_name: string;
  readonly job_role: string;
  readonly round_type: string;
  readonly calibration_mode: PracticeSessionRecord['calibration_mode'];
  readonly difficulty_vector: PracticeSessionRecord['difficulty_vector'];
  readonly weighted_score: number;
  readonly baseline_delta: number;
  readonly session_number: number;
  readonly rubric_version_id: string;
  readonly merkle_root_hash: string | null;
  readonly replay_jsonl_url: string | null;
  readonly trustmodel_cert_url: string | null;
  readonly created_at: string;
} {
  if (!isUuid(record.candidate_id)) throw new Error('Practice session requires a valid candidate UUID.');
  if (record.weighted_score === null) throw new Error('Practice session requires a weighted score.');
  return {
    id: record.id,
    candidate_id: record.candidate_id,
    blueprint_id: record.blueprint_id,
    blueprint_version: record.blueprint_version,
    company_name: record.company_name,
    job_role: record.job_role,
    round_type: record.round_type,
    calibration_mode: record.calibration_mode,
    difficulty_vector: record.difficulty_vector,
    weighted_score: record.weighted_score,
    baseline_delta: record.baseline_delta,
    session_number: record.session_number,
    rubric_version_id: record.rubric_version_id,
    merkle_root_hash: record.merkle_root_hash,
    replay_jsonl_url: record.replay_jsonl_url,
    trustmodel_cert_url: record.trustmodel_cert_url,
    created_at: record.created_at,
  };
}
