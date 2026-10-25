
import { describe, expect, it } from 'vitest';

import type { Blueprint } from '@/types/phase6_contracts';
import type { DifficultyVector } from '@/types/phase7_contracts';
import { createModeConfig } from '@/agents/module5-blueprint/simulation-engine';

const blueprint = {
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
  inputs: {} as never,
  created_at: '2026-10-25T12:00:00.000Z',
} as Blueprint;

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

describe('Phase 7 fairness and capability invariance', () => {
  it('keeps Mode B difficulty locked when candidate capability changes', () => {
    const weak = createModeConfig({ blueprint, mode: 'Mode_B', candidateCapability: { weak_topics: ['dynamic_programming'], strong_topics: [], completed_sessions: 3, last_weighted_score: 1, declared_skills: ['typescript'] }, difficulty });
    const strong = createModeConfig({ blueprint, mode: 'Mode_B', candidateCapability: { weak_topics: [], strong_topics: ['dynamic_programming'], completed_sessions: 3, last_weighted_score: 5, declared_skills: ['typescript'] }, difficulty });
    expect(weak.difficulty_vector).toEqual(strong.difficulty_vector);
    expect(weak.sampled_topic).toBe('dynamic_programming');
  });

  it('does not expose candidate identity in mode configuration', () => {
    const mode = createModeConfig({ blueprint, mode: 'Mode_B', candidateCapability: { weak_topics: [], strong_topics: [], completed_sessions: 0, last_weighted_score: null, declared_skills: ['typescript'] }, difficulty });
    expect(JSON.stringify(mode)).not.toContain('email');
    expect(JSON.stringify(mode)).not.toContain('college');
  });
});
