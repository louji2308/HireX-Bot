import { describe, expect, it } from 'vitest';

import type { PracticeSessionRecord } from '@/types/phase7_contracts';
import { toPracticeSessionRow } from '@/lib/module5/session-row';

const record: PracticeSessionRecord = {
  id: '00000000-0000-4000-8000-000000000701',
  candidate_id: '00000000-0000-4000-8000-000000000702',
  blueprint_id: 'blueprint-1',
  blueprint_version: 'v1.0',
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  round_type: 'Coding',
  calibration_mode: 'Mode_B',
  difficulty_vector: {
    concept_complexity: 2,
    problem_solving_depth: 2,
    edge_case_density: 2,
    specification_ambiguity: 2,
    time_pressure: 2,
    follow_up_depth: 2,
    independence: 2,
    expected_completeness: 2,
  },
  weighted_score: 4.2,
  baseline_delta: 1.1,
  session_number: 1,
  rubric_version_id: 'phase7.rubric.v1',
  merkle_root_hash: null,
  replay_jsonl_url: null,
  trustmodel_cert_url: null,
  created_at: '2026-10-25T12:00:00.000Z',
};

describe('Phase 7 practice session row mapper', () => {
  it('maps a record to the frozen Phase 2 insert shape', () => {
    const row = toPracticeSessionRow(record);
    expect(row.id).toBe(record.id);
    expect(row.candidate_id).toBe(record.candidate_id);
    expect(row.blueprint_id).toBe(record.blueprint_id);
    expect(row.calibration_mode).toBe('Mode_B');
    expect(row.weighted_score).toBe(4.2);
  });

  it('rejects an invalid candidate UUID', () => {
    expect(() => toPracticeSessionRow({ ...record, candidate_id: 'not-a-uuid' })).toThrow();
  });
});
