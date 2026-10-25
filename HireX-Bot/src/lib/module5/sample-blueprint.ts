import type { BlueprintInputs } from '@/types/phase6_contracts';
import { generateBlueprint } from '@/agents/module5-blueprint/blueprint-generator';

const input: BlueprintInputs = {
  company: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  selected_round: 'Coding',
  expected_format: 'live_coding',
  candidate_capability: {
    weak_topics: ['dynamic_programming'],
    strong_topics: ['arrays'],
    completed_sessions: 0,
    last_weighted_score: null,
    declared_skills: ['typescript', 'algorithms'],
  },
  interview_deadline: null,
};

export function sampleBlueprint() {
  return generateBlueprint(input);
}
