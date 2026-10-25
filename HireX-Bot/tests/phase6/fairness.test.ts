import { describe, expect, it } from 'vitest';

import type { BlueprintInputs } from '@/types/phase6_contracts';
import { generateBlueprint } from '@/agents/module5-blueprint/blueprint-generator';

const base: BlueprintInputs = {
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
};

describe('Phase 6 blueprint fairness', () => {
  it('changes topic distribution without changing competency weights when capability changes', () => {
    const dsa = generateBlueprint(base);
    const web = generateBlueprint({
      ...base,
      candidate_capability: { ...base.candidate_capability, declared_skills: ['react', 'node'] },
    });
    expect(dsa.evaluation_criteria_weights).toEqual(web.evaluation_criteria_weights);
    expect(dsa.question_distribution).not.toEqual(web.question_distribution);
  });

  it('does not expose candidate identity fields in the blueprint', () => {
    const blueprint = generateBlueprint(base);
    expect(JSON.stringify(blueprint)).not.toContain('email');
    expect(JSON.stringify(blueprint)).not.toContain('college');
  });
});
