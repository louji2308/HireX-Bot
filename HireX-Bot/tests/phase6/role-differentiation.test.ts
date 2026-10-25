import { describe, expect, it } from 'vitest';

import type { BlueprintInputs } from '@/types/phase6_contracts';
import { generateBlueprint } from '@/agents/module5-blueprint/blueprint-generator';

const amazonSde: BlueprintInputs = {
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
    declared_skills: ['typescript', 'algorithms'],
  },
  interview_deadline: null,
};

const amazonQae: BlueprintInputs = {
  ...amazonSde,
  job_role: 'Quality Assurance Engineer',
  selected_round: 'Role_Specific_Practical',
  expected_format: 'take_home',
};

describe('Phase 6 role differentiation', () => {
  it('produces different competency weights for SDE and QAE', () => {
    const sde = generateBlueprint(amazonSde);
    const qae = generateBlueprint(amazonQae);
    expect(sde.evaluation_criteria_weights).not.toEqual(qae.evaluation_criteria_weights);
  });

  it('produces different question distributions for SDE and QAE', () => {
    const sde = generateBlueprint(amazonSde);
    const qae = generateBlueprint(amazonQae);
    expect(sde.question_distribution).not.toEqual(qae.question_distribution);
  });

  it('records an official Amazon source URL', () => {
    const sde = generateBlueprint(amazonSde);
    expect(sde.source_urls.some((url) => url.includes('amazon.jobs'))).toBe(true);
  });
});
