import type {
  BlueprintInputs,
  PistonRunResult,
  PistonTestCase,
  Stage5Verification,
} from '@/types/phase6_contracts';

export interface Stage5PistonInput {
  readonly language: string;
  readonly referenceSolution: string;
  readonly hiddenTests: readonly PistonTestCase[];
  readonly mutatedBaseline: string;
  readonly piston: { execute(request: { readonly language: string; readonly source: string }): Promise<PistonRunResult> };
}

export async function verifyStage5Piston(input: Stage5PistonInput): Promise<Stage5Verification> {
  const referenceRun = await input.piston.execute({ language: input.language, source: input.referenceSolution });
  const mutatedRun = await input.piston.execute({ language: input.language, source: input.mutatedBaseline });

  let passed = referenceRun.outcome === 'pass' && mutatedRun.outcome !== 'pass';
  let rejectionReason: string | null = null;

  if (referenceRun.outcome === 'time_limit_exceeded') {
    passed = false;
    rejectionReason = 'Stage 5 reference solution timeout.';
  } else if (referenceRun.outcome !== 'pass') {
    passed = false;
    rejectionReason = `Stage 5 reference solution failed: ${referenceRun.outcome}.`;
  } else if (mutatedRun.outcome === 'pass') {
    passed = false;
    rejectionReason = 'Stage 5 rejected a weak test suite: mutated baseline passed.';
  }

  return {
    reference_run: referenceRun,
    mutated_run: mutatedRun,
    hidden_tests: input.hiddenTests,
    passed,
    rejection_reason: rejectionReason,
  };
}

export function bundleCacheKey(input: BlueprintInputs): string {
  return JSON.stringify(input);
}

export function resolvePreWarmedBundle<T>(cache: ReadonlyMap<string, T>, key: string): T | null {
  return cache.get(key) ?? null;
}

