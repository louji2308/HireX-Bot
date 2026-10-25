import type { CandidateCapabilityHistory } from '@/types/phase6_contracts';
import type { Blueprint } from '@/types/phase6_contracts';
import type { DifficultyVector, ModeConfig, ModeExecutionPolicy } from '@/types/phase7_contracts';
import { MODE_EXECUTION_POLICIES } from '@/types/phase7_contracts';

export function createModeConfig(input: {
  readonly blueprint: Blueprint;
  readonly mode: ModeConfig['mode'];
  readonly candidateCapability: CandidateCapabilityHistory;
  readonly difficulty: DifficultyVector;
}): ModeConfig {
  const policy: ModeExecutionPolicy = MODE_EXECUTION_POLICIES[input.mode];
  return {
    mode: input.mode,
    sampled_topic: input.candidateCapability.weak_topics[0] ?? 'core_algorithms',
    difficulty_vector: input.difficulty,
    difficulty_locked_to_blueprint: policy.difficulty_locked_to_blueprint,
    hints_allowed: policy.hints_allowed,
    vernacular_allowed: policy.vernacular_allowed,
    proctored: policy.proctored,
    replay_required: policy.replay_required,
    is_first_attempt_unassisted: input.mode !== 'Mode_A',
  };
}

export { MODE_EXECUTION_POLICIES };
