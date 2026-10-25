import type { Blueprint } from '@/types/phase6_contracts';
import type { PistonRunResult } from '@/types/phase6_contracts';
import type { CriterionScore, GradingResult } from '@/types/phase7_contracts';

interface LlmGrader {
  grade(input: { blueprint: Blueprint; candidateCode: string; pistonResult: PistonRunResult }): Promise<{
    criteria: readonly CriterionScore[];
    weighted_score: number;
  }>;
}

export async function evaluateResponse(input: {
  readonly blueprint: Blueprint;
  readonly candidateCode: string;
  readonly pistonResult: PistonRunResult;
  readonly llm: LlmGrader | null;
}): Promise<GradingResult> {
  if (input.llm === null) {
    return {
      session_id: 'pending',
      criteria: [],
      weighted_score: null,
      piston_hidden_tests_passed: input.pistonResult.tests_passed,
      piston_hidden_tests_total: input.pistonResult.tests_total,
      correctness_capped: false,
      grader_model: 'unavailable',
      graded_at: new Date().toISOString(),
      llm_available: false,
      graded: false,
    };
  }

  const graded = await input.llm.grade({
    blueprint: input.blueprint,
    candidateCode: input.candidateCode,
    pistonResult: input.pistonResult,
  });

  const correctnessCap = input.pistonResult.outcome === 'pass' ? 5 : 2;
  const criteria = graded.criteria.map((criterion) => (
    criterion.criterion === 'correctness'
      ? { ...criterion, score: Math.min(criterion.score, correctnessCap) }
      : criterion
  ));

  return {
    session_id: 'pending',
    criteria,
    weighted_score: graded.weighted_score,
    piston_hidden_tests_passed: input.pistonResult.tests_passed,
    piston_hidden_tests_total: input.pistonResult.tests_total,
    correctness_capped: input.pistonResult.outcome !== 'pass',
    grader_model: 'gpt-5-codex',
    graded_at: new Date().toISOString(),
    llm_available: true,
    graded: true,
  };
}
