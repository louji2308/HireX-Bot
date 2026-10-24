import { describe, expect, it } from 'vitest';

import { sampleCandidate } from '@/agents/module4-discovery/candidate';
import { assessEligibility } from '@/agents/module4-discovery/eligibility';
import type { OpportunitySnapshot } from '@/types/phase5_contracts';

import { capturedSnapshots, NOW } from './fixtures';

async function snapshot(titlePart: string): Promise<OpportunitySnapshot> {
  const found = (await capturedSnapshots()).find((item) => item.title.includes(titlePart));
  if (!found) throw new Error(`Missing snapshot ${titlePart}`);
  return found;
}

describe('Phase 5 eligibility boundaries', () => {
  it('passes an internship with no stated experience or degree boundary', async () => {
    const result = assessEligibility(await snapshot('Intern'), sampleCandidate(), NOW);
    expect(result.status).toBe('pass');
    expect(result.checks.find((check) => check.id === 'experience')?.status).toBe('pass');
  });

  it('fails only on a confirmed experience boundary', async () => {
    const result = assessEligibility(await snapshot('Test II'), sampleCandidate(), NOW);
    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'experience')).toMatchObject({
      status: 'fail',
      hard: true,
    });
  });

  it('treats a missing degree as unknown, not as a failure', async () => {
    const intern = await snapshot('Intern');
    const result = assessEligibility(
      {
        ...intern,
        requirements: {
          ...intern.requirements,
          degree_required: 'B.Tech',
          min_experience_years: null,
        },
      },
      sampleCandidate(),
      NOW,
    );
    expect(result.status).toBe('unknown');
    expect(result.checks.find((check) => check.id === 'degree')).toMatchObject({
      status: 'unknown',
      hard: true,
    });
  });

  it('does not apply a hard compensation boundary when the listing omits pay', async () => {
    const intern = await snapshot('Intern');
    const result = assessEligibility(
      {
        ...intern,
        requirements: { ...intern.requirements, min_experience_years: null },
      },
      sampleCandidate(),
      NOW,
    );
    expect(result.status).toBe('pass');
    expect(result.checks.find((check) => check.id === 'compensation')).toMatchObject({
      status: 'unknown',
      hard: false,
    });
  });

  it('rejects a different city when relocation is off', async () => {
    const intern = await snapshot('Intern');
    const result = assessEligibility(
      { ...intern, requirements: { ...intern.requirements, min_experience_years: null } },
      { ...sampleCandidate(), locations: ['pune'], relocation: false },
      NOW,
    );
    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'location')?.status).toBe('fail');
  });

  it('accepts credit-only work without inventing a pay floor', async () => {
    const intern = await snapshot('Intern');
    const result = assessEligibility(
      { ...intern, requirements: { ...intern.requirements, min_experience_years: null } },
      { ...sampleCandidate(), compensation_floor: 'credit_only' },
      NOW,
    );
    expect(result.status).toBe('pass');
    expect(result.checks.find((check) => check.id === 'compensation')?.status).toBe('not_applicable');
  });

  it('fails a confirmed graduation-year mismatch', async () => {
    const intern = await snapshot('Intern');
    const result = assessEligibility(
      {
        ...intern,
        requirements: {
          ...intern.requirements,
          min_experience_years: null,
          graduation_years: [2027],
        },
      },
      { ...sampleCandidate(), graduation_year: 2026 },
      NOW,
    );
    expect(result.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'graduation_year')?.status).toBe('fail');
  });
});
