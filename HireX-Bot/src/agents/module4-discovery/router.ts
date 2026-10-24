import {
  PHASE5_ROUTER_VERSION,
  type DimensionScore,
  type EligibilityResult,
  type OpportunityDecision,
  type OpportunityQualityResult,
  type RoleFitResult,
} from '@/types/phase5_contracts';

export interface RouterInput {
  readonly eligibility: EligibilityResult;
  readonly role_fit: RoleFitResult;
  readonly evidence_strength: DimensionScore;
  readonly interview_readiness: DimensionScore;
  readonly opportunity_quality: OpportunityQualityResult;
}

export class RouterInputError extends Error {
  readonly code = 'ROUTER_INPUT_INCOMPLETE';

  constructor(message: string) {
    super(message);
    this.name = 'RouterInputError';
  }
}

function measured(score: DimensionScore): score is Extract<DimensionScore, { status: 'assessed' }> {
  return score.status === 'assessed' && Number.isFinite(score.value);
}

function firstHardFailure(eligibility: EligibilityResult): string | null {
  return eligibility.checks.find((check) => check.hard && check.status === 'fail')?.detail ?? null;
}

function baseDecision(input: RouterInput): Pick<
  OpportunityDecision,
  'missing_core_skills' | 'missing_preferred_skills'
> {
  return {
    missing_core_skills: input.role_fit.core_missing,
    missing_preferred_skills: input.role_fit.preferred_missing,
  };
}

export function routeOpportunity(input: RouterInput): OpportunityDecision {
  if (!input.role_fit || input.role_fit.status !== 'assessed' || !Number.isFinite(input.role_fit.value)) {
    throw new RouterInputError('Role fit must be assessed before routing.');
  }
  if (!PHASE5_ROUTER_VERSION) {
    throw new RouterInputError('Router version is missing.');
  }
  const missing = baseDecision(input);

  if (input.eligibility.status === 'fail') {
    return {
      state: 'State_4',
      reason_code: 'eligibility_boundary',
      explanation:
        firstHardFailure(input.eligibility) ??
        'A confirmed requirement in the captured listing is outside this profile boundary.',
      ...missing,
      requires_confirmation: false,
    };
  }

  if (input.opportunity_quality.status === 'fail') {
    const finding = input.opportunity_quality.findings.find((item) => item.severity === 'high');
    return {
      state: 'State_4',
      reason_code: 'quality_boundary',
      explanation: finding
        ? `${finding.label} appears in the captured listing. Check the source before doing anything else.`
        : 'The captured listing contains a high-severity fee or deposit phrase. Check the source before doing anything else.',
      ...missing,
      requires_confirmation: false,
    };
  }

  if (input.role_fit.value < 65) {
    return {
      state: 'State_3',
      reason_code: 'role_fit_below_threshold',
      explanation: `Core skill overlap is ${input.role_fit.value}/100. Build the missing core skills before investing in this application.`,
      ...missing,
      requires_confirmation: false,
    };
  }

  if (input.eligibility.status === 'unknown') {
    const unknown = input.eligibility.checks.find((check) => check.hard && check.status === 'unknown');
    return {
      state: 'State_2',
      reason_code: 'eligibility_confirmation',
      explanation:
        unknown?.detail ??
        'A hard requirement could not be confirmed from the captured listing. Check the source before applying.',
      ...missing,
      requires_confirmation: true,
    };
  }

  if (input.opportunity_quality.status === 'needs_review') {
    return {
      state: 'State_2',
      reason_code: 'quality_review',
      explanation:
        'A bond or service-agreement phrase was found in the captured excerpt. Check the source before applying.',
      ...missing,
      requires_confirmation: true,
    };
  }

  const evidenceReady = measured(input.evidence_strength) && input.evidence_strength.value >= 70;
  const readinessReady = measured(input.interview_readiness) && input.interview_readiness.value >= 70;

  if (input.role_fit.value >= 75 && evidenceReady && readinessReady) {
    return {
      state: 'State_1',
      reason_code: 'verified_thresholds_met',
      explanation:
        'Role fit, measured proof of work, and measured interview readiness all clear the publishing thresholds.',
      ...missing,
      requires_confirmation: false,
    };
  }

  if (input.role_fit.value >= 65) {
    return {
      state: 'State_2',
      reason_code: 'apply_while_calibrating',
      explanation: `Core skill overlap is ${input.role_fit.value}/100. A specific gap is being closed before submission; evidence and interview readiness are not assessed yet.`,
      ...missing,
      requires_confirmation: false,
    };
  }

  return {
    state: 'State_3',
    reason_code: 'prepare_and_revisit',
    explanation: `Core skill overlap is ${input.role_fit.value}/100. The role is reachable, but core coverage needs to improve first.`,
    ...missing,
    requires_confirmation: false,
  };
}
