
import { describe, expect, it } from 'vitest';

import type { Blueprint, BlueprintInputs, CandidateCapabilityHistory } from '@/types/phase6_contracts';
import type { DifficultyVector, ModeConfig } from '@/types/phase7_contracts';
import { createModeConfig, MODE_EXECUTION_POLICIES } from '@/agents/module5-blueprint/simulation-engine';

const capability: CandidateCapabilityHistory = {
  weak_topics: ['dynamic_programming'],
  strong_topics: ['arrays'],
  completed_sessions: 3,
  last_weighted_score: 1,
  declared_skills: ['typescript'],
};

const blueprint: Blueprint = {
  id: 'blueprint-1',
  candidate_id: null,
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  round_type: 'Coding',
  blueprint_version: 'v1.0',
  evaluation_criteria_weights: { correctness: 40, complexity: 25, code_quality: 20, explanation: 15 },
  question_distribution: { dsa: 60, system_design: 20, behavioral: 20 },
  duration_minutes: 45,
  confidence_tier: 'Verified — Official Documentation',
  source_urls: ['https://www.amazon.jobs/en/jobs/123'],
  visibility: 'shared',
  inputs: {
    company: 'Amazon',
    job_role: 'Software Development Engineer',
    candidate_level: 'New_Grad_Fresher',
    selected_round: 'Coding',
    expected_format: 'live_coding',
    candidate_capability: capability,
    interview_deadline: null,
  } as BlueprintInputs,
  created_at: '2026-10-25T12:00:00.000Z',
};

const difficulty: DifficultyVector = {
  concept_complexity: 2,
  problem_solving_depth: 2,
  edge_case_density: 2,
  specification_ambiguity: 2,
  time_pressure: 2,
  follow_up_depth: 2,
  independence: 2,
  expected_completeness: 2,
};

describe('Phase 7 mode calibration guardrail', () => {
  it('samples a weak topic for Mode B without lowering difficulty', () => {
    const mode = createModeConfig({ blueprint, mode: 'Mode_B', candidateCapability: capability, difficulty });
    expect(mode.sampled_topic).toBe('dynamic_programming');
    expect(mode.difficulty_vector).toEqual(difficulty);
    expect(mode.difficulty_locked_to_blueprint).toBe(true);
    expect(mode.hints_allowed).toBe(false);
    expect(mode.is_first_attempt_unassisted).toBe(true);
  });

  it('allows hints and vernacular only in Mode A', () => {
    const mode = createModeConfig({ blueprint, mode: 'Mode_A', candidateCapability: capability, difficulty });
    expect(mode.hints_allowed).toBe(true);
    expect(mode.vernacular_allowed).toBe(true);
    expect(mode.is_first_attempt_unassisted).toBe(false);
  });

  it('locks Mode C to the blueprint bar', () => {
    const mode = createModeConfig({ blueprint, mode: 'Mode_C', candidateCapability: capability, difficulty });
    expect(mode.difficulty_locked_to_blueprint).toBe(true);
    expect(mode.proctored).toBe(true);
    expect(mode.replay_required).toBe(true);
  });
});

describe('Phase 7 mode execution policy', () => {
  it('publishes the three mode policies', () => {
    expect(MODE_EXECUTION_POLICIES.Mode_A.hints_allowed).toBe(true);
    expect(MODE_EXECUTION_POLICIES.Mode_B.hints_allowed).toBe(false);
    expect(MODE_EXECUTION_POLICIES.Mode_C.replay_required).toBe(true);
  });
});
