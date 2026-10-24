import {
  PHASE5_SCORING_VERSION,
  type CandidateScoringInput,
  type OpportunityRequirements,
  type RoleFitResult,
} from '@/types/phase5_contracts';

import { canonicalizeSkills } from './skill-vocabulary';

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function coverage(required: readonly string[], available: ReadonlySet<string>): number {
  if (required.length === 0) return 0;
  return required.filter((skill) => available.has(skill)).length / required.length;
}

export function scoreRoleFit(
  requirements: OpportunityRequirements,
  candidate: CandidateScoringInput,
): RoleFitResult {
  const core = unique(canonicalizeSkills(requirements.core_skills));
  const preferred = unique(canonicalizeSkills(requirements.preferred_skills));
  const available = new Set(canonicalizeSkills(candidate.declared_skills));

  if (core.length === 0) {
    throw new Error('Role fit requires at least one normalized core skill.');
  }

  const coreMatched = core.filter((skill) => available.has(skill));
  const coreMissing = core.filter((skill) => !available.has(skill));
  const preferredMatched = preferred.filter((skill) => available.has(skill));
  const preferredMissing = preferred.filter((skill) => !available.has(skill));

  const coreCoverage = coverage(core, available);
  const preferredCoverage = preferred.length === 0 ? 1 : coverage(preferred, available);
  const value =
    preferred.length === 0
      ? Math.round(coreCoverage * 100)
      : Math.round((coreCoverage * 0.8 + preferredCoverage * 0.2) * 100);

  return {
    status: 'assessed',
    value: Math.max(0, Math.min(100, value)),
    method: PHASE5_SCORING_VERSION,
    label: 'Declared skill overlap; not verified',
    core_matched: coreMatched,
    core_missing: coreMissing,
    preferred_matched: preferredMatched,
    preferred_missing: preferredMissing,
  };
}
