import { describe, expect, it } from 'vitest';

import type { PracticeSessionRecord } from '@/types/phase7_contracts';
import { MemoryPracticeSessionStore } from '@/lib/module5/session-store';

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

describe('Phase 7 session store', () => {
  it('stores and reads a practice session without claiming durability', async () => {
    const store = new MemoryPracticeSessionStore();
    expect(store.durable).toBe(false);
    await store.write(record);
    expect(await store.read(record.id)).toEqual(record);
  });

  it('erases a stored session', async () => {
    const store = new MemoryPracticeSessionStore();
    await store.write(record);
    expect(await store.erase(record.id)).toBe(true);
    expect(await store.read(record.id)).toBeNull();
    expect(await store.erase(record.id)).toBe(false);
  });
});
