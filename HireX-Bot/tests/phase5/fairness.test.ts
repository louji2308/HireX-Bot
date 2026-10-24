import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sampleCandidate } from '@/agents/module4-discovery/candidate';
import { assessOpportunity } from '@/agents/module4-discovery/assessment';
import { discoverOpportunities, toBoardResponse } from '@/agents/module4-discovery/workspace';
import type { CandidateScoringInput } from '@/types/phase5_contracts';

import {
  capturedSnapshots,
  NOW,
  TEST_CANDIDATE_ID,
  TEST_SESSION_ID,
} from './fixtures';

function withIdentityNoise(
  candidate: CandidateScoringInput,
  noise: {
    full_name: string;
    email: string;
    college_tier: string;
    preferred_language: string;
    resume_text: string;
  },
): CandidateScoringInput {
  return { ...candidate, ...noise } as CandidateScoringInput;
}

function decisionsFor(candidate: CandidateScoringInput, snapshots: Awaited<ReturnType<typeof capturedSnapshots>>) {
  return snapshots.map((snapshot) => {
    const assessment = assessOpportunity(snapshot, candidate, { now: NOW });
    return {
      state: assessment.decision.state,
      role_fit: assessment.fit_scores_5d.role_fit.value,
      eligibility: assessment.fit_scores_5d.eligibility.status,
      quality: assessment.fit_scores_5d.opportunity_quality.status,
    };
  });
}

describe('Phase 5 fairness and identity separation', () => {
  it('does not let identity or college-tier fields change any decision', async () => {
    const snapshots = await capturedSnapshots();
    const candidate = sampleCandidate();
    const variants = [
      withIdentityNoise(candidate, {
        full_name: 'Asha Rao',
        email: 'asha@example.com',
        college_tier: 'Tier_1',
        preferred_language: 'en',
        resume_text: 'A long private resume that must never affect scoring.',
      }),
      withIdentityNoise(candidate, {
        full_name: 'Rural Candidate',
        email: 'rural@example.com',
        college_tier: 'Rural',
        preferred_language: 'ta',
        resume_text: 'Different private text.',
      }),
    ];

    const baseline = decisionsFor(candidate, snapshots);
    expect(decisionsFor(variants[0]!, snapshots)).toEqual(baseline);
    expect(decisionsFor(variants[1]!, snapshots)).toEqual(baseline);

    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.constantFrom('Tier_1', 'Tier_2', 'Tier_3', 'Rural'),
        fc.constantFrom('ta', 'hi', 'te', 'kn', 'bn', 'mr', 'en'),
        fc.string(),
        (name, email, collegeTier, language, resume) => {
          const noisy = withIdentityNoise(candidate, {
            full_name: name,
            email,
            college_tier: collegeTier,
            preferred_language: language,
            resume_text: resume,
          });
          return JSON.stringify(decisionsFor(noisy, snapshots)) === JSON.stringify(baseline);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('does not expose identity noise through the board response', async () => {
    const snapshots = await capturedSnapshots();
    const noisy = withIdentityNoise(sampleCandidate(), {
      full_name: 'Private Name',
      email: 'private@example.com',
      college_tier: 'Tier_1',
      preferred_language: 'en',
      resume_text: 'Private resume content.',
    });
    const workspace = discoverOpportunities({
      snapshots,
      candidate: noisy,
      sessionId: TEST_SESSION_ID,
      candidateId: TEST_CANDIDATE_ID,
      source: 'snapshot_preview',
      sampleCandidate: false,
      now: NOW,
    });
    const serialized = JSON.stringify(toBoardResponse(workspace));
    expect(serialized).not.toContain('Private Name');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Private resume content');
    expect(serialized).not.toContain('Tier_1');
  });
});
