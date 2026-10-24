import { describe, expect, it } from 'vitest';

import { routeOpportunity, type RouterInput } from '@/agents/module4-discovery/router';
import type {
  DimensionScore,
  EligibilityResult,
  OpportunityQualityResult,
  RoleFitResult,
} from '@/types/phase5_contracts';

function eligible(): EligibilityResult {
  return { status: 'pass', checks: [], warnings: [] };
}

function unknownEligibility(): EligibilityResult {
  return {
    status: 'unknown',
    checks: [
      {
        id: 'degree',
        label: 'Degree',
        status: 'unknown',
        hard: true,
        detail: 'The listing states a degree requirement, but no degree is confirmed.',
      },
    ],
    warnings: [],
  };
}

function failedEligibility(): EligibilityResult {
  return {
    status: 'fail',
    checks: [
      {
        id: 'experience',
        label: 'Experience',
        status: 'fail',
        hard: true,
        detail: 'The listing asks for 3 years.',
      },
    ],
    warnings: [],
  };
}

function roleFit(value: number): RoleFitResult {
  return {
    status: 'assessed',
    value,
    method: 'phase5.role-fit.v1',
    label: 'Declared skill overlap; not verified',
    core_matched: [],
    core_missing: ['system_design'],
    preferred_matched: [],
    preferred_missing: ['apis'],
  };
}

function cleanQuality(): OpportunityQualityResult {
  return {
    status: 'pass',
    rules_version: 'phase5.quality.v1',
    scanned_chars: 20,
    findings: [],
    note: 'No fee phrase found.',
  };
}

function reviewQuality(): OpportunityQualityResult {
  return {
    status: 'needs_review',
    rules_version: 'phase5.quality.v1',
    scanned_chars: 20,
    findings: [
      {
        rule_id: 'bond_or_service_agreement',
        severity: 'medium',
        label: 'Bond or service agreement',
        quote: 'A two-year bond applies.',
      },
    ],
    note: 'A bond phrase needs a human check.',
  };
}

function failedQuality(): OpportunityQualityResult {
  return {
    status: 'fail',
    rules_version: 'phase5.quality.v1',
    scanned_chars: 20,
    findings: [
      {
        rule_id: 'training_fee',
        severity: 'high',
        label: 'Training fee',
        quote: 'A training fee is required.',
      },
    ],
    note: 'A fee phrase was found.',
  };
}

function measured(value: number): DimensionScore {
  return { status: 'assessed', value, method: 'fixture.v1', label: 'Measured fixture' };
}

const notAssessed: DimensionScore = {
  status: 'not_assessed',
  value: null,
  reason: 'source_module_absent',
  detail: 'The source module is absent.',
};

function input(overrides: Partial<RouterInput> = {}): RouterInput {
  return {
    eligibility: eligible(),
    role_fit: roleFit(70),
    evidence_strength: notAssessed,
    interview_readiness: notAssessed,
    opportunity_quality: cleanQuality(),
    ...overrides,
  };
}

describe('Phase 5 total four-state router', () => {
  it('routes a confirmed eligibility boundary to State 4', () => {
    expect(routeOpportunity(input({ eligibility: failedEligibility() })).state).toBe('State_4');
  });

  it('routes a confirmed quality boundary to State 4', () => {
    expect(
      routeOpportunity(input({ role_fit: roleFit(95), opportunity_quality: failedQuality() })).state,
    ).toBe('State_4');
  });

  it('routes low core overlap to State 3 before unknown eligibility', () => {
    const decision = routeOpportunity(
      input({ role_fit: roleFit(64), eligibility: unknownEligibility() }),
    );
    expect(decision.state).toBe('State_3');
    expect(decision.reason_code).toBe('role_fit_below_threshold');
  });

  it('routes unknown eligibility to State 2 with confirmation', () => {
    const decision = routeOpportunity(
      input({ role_fit: roleFit(70), eligibility: unknownEligibility() }),
    );
    expect(decision.state).toBe('State_2');
    expect(decision.reason_code).toBe('eligibility_confirmation');
    expect(decision.requires_confirmation).toBe(true);
  });

  it('routes a bond to State 2 for human review', () => {
    const decision = routeOpportunity(
      input({ role_fit: roleFit(70), opportunity_quality: reviewQuality() }),
    );
    expect(decision.state).toBe('State_2');
    expect(decision.reason_code).toBe('quality_review');
    expect(decision.requires_confirmation).toBe(true);
  });

  it('never reaches State 1 without measured evidence and readiness', () => {
    const decision = routeOpportunity(input({ role_fit: roleFit(90) }));
    expect(decision.state).toBe('State_2');
    expect(decision.reason_code).toBe('apply_while_calibrating');
  });

  it('reaches State 1 only when both measured dimensions clear 70', () => {
    const decision = routeOpportunity(
      input({
        role_fit: roleFit(75),
        evidence_strength: measured(70),
        interview_readiness: measured(70),
      }),
    );
    expect(decision.state).toBe('State_1');
    expect(decision.reason_code).toBe('verified_thresholds_met');
  });

  it('does not reach State 1 with evidence at 69', () => {
    const decision = routeOpportunity(
      input({
        role_fit: roleFit(90),
        evidence_strength: measured(69),
        interview_readiness: measured(90),
      }),
    );
    expect(decision.state).toBe('State_2');
  });

  it('rejects an unassessed role fit as an incomplete routing input', () => {
    expect(() =>
      routeOpportunity(
        input({
          role_fit: { ...roleFit(70), status: 'unassessed' as unknown as 'assessed' },
        }),
      ),
    ).toThrow(/Role fit must be assessed/);
  });
});
