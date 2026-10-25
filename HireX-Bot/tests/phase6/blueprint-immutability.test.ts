import { describe, expect, it } from 'vitest';

import type { Blueprint } from '@/types/phase6_contracts';
import { toInterviewBlueprintRow } from '@/agents/module5-blueprint/blueprint-generator';

const blueprint: Blueprint = {
  id: null,
  candidate_id: null,
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  round_type: 'Coding',
  blueprint_version: 'v1.0',
  evaluation_criteria_weights: { correctness: 40, complexity: 25, code_quality: 20, explanation: 15 },
  question_distribution: { dsa: 60, system_design: 20, behavioral: 20 },
  duration_minutes: 45,
  confidence_tier: 'Verified - Official Documentation',
  source_urls: ['https://www.amazon.jobs/en/jobs/123'],
  visibility: 'shared',
  inputs: {
    company: 'Amazon',
    job_role: 'Software Development Engineer',
    candidate_level: 'New_Grad_Fresher',
    selected_round: 'Coding',
    expected_format: 'live_coding',
    candidate_capability: {
      weak_topics: [],
      strong_topics: ['dsa'],
      completed_sessions: 0,
      last_weighted_score: null,
      declared_skills: ['typescript'],
    },
    interview_deadline: null,
  },
  created_at: null,
};

describe('Phase 6 blueprint immutability mapper', () => {
  it('maps a shared blueprint without mutating the source', () => {
    const row = toInterviewBlueprintRow(blueprint);
    expect(row.company_name).toBe('Amazon');
    expect(row.visibility).toBe('shared');
    expect(row.candidate_id).toBeNull();
    expect(row.blueprint_version).toBe('v1.0');
    expect(blueprint.id).toBeNull();
  });

  it('maps a candidate-scoped blueprint with a valid UUID', () => {
    const candidateId = '00000000-0000-4000-8000-000000000601';
    const row = toInterviewBlueprintRow({ ...blueprint, candidate_id: candidateId, visibility: 'candidate' }, candidateId);
    expect(row.candidate_id).toBe(candidateId);
    expect(row.visibility).toBe('candidate');
  });

  it('rejects an invalid candidate UUID', () => {
    expect(() => toInterviewBlueprintRow({ ...blueprint, candidate_id: 'not-a-uuid', visibility: 'candidate' }, 'not-a-uuid')).toThrow();
  });
});
