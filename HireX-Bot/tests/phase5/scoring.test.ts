import { describe, expect, it } from 'vitest';

import { sampleCandidate } from '@/agents/module4-discovery/candidate';
import { scoreRoleFit } from '@/agents/module4-discovery/role-fit';
import { discoverOpportunities } from '@/agents/module4-discovery/workspace';
import type { OpportunityRequirements } from '@/types/phase5_contracts';

import { capturedSnapshots, NOW, TEST_CANDIDATE_ID, TEST_SESSION_ID } from './fixtures';

const baseRequirements: OpportunityRequirements = {
  core_skills: ['javascript', 'python'],
  preferred_skills: ['sql', 'apis', 'debugging', 'communication'],
  min_experience_years: null,
  max_experience_years: null,
  degree_required: null,
  graduation_years: null,
};

describe('Phase 5 deterministic role fit', () => {
  it('uses declared skill overlap with an 80/20 core/preferred split', () => {
    const candidate = sampleCandidate();
    const result = scoreRoleFit(baseRequirements, candidate);
    expect(result.status).toBe('assessed');
    expect(result.value).toBe(85);
    expect(result.core_matched).toEqual(['javascript', 'python']);
    expect(result.preferred_matched).toEqual(['sql']);
    expect(result.label).toBe('Declared skill overlap; not verified');
  });

  it('uses core coverage alone when there are no preferred skills', () => {
    const result = scoreRoleFit(
      { ...baseRequirements, preferred_skills: [] },
      { ...sampleCandidate(), declared_skills: ['javascript'] },
    );
    expect(result.value).toBe(50);
  });

  it('does not confuse Java with JavaScript or SQL with NoSQL', () => {
    const result = scoreRoleFit(
      {
        ...baseRequirements,
        core_skills: ['java', 'sql'],
        preferred_skills: [],
      },
      { ...sampleCandidate(), declared_skills: ['javascript', 'mongodb'] },
    );
    expect(result.value).toBe(0);
    expect(result.core_missing).toEqual(['java', 'sql']);
  });

  it('is deterministic across the same declared set', () => {
    const first = scoreRoleFit(baseRequirements, sampleCandidate());
    const second = scoreRoleFit(baseRequirements, sampleCandidate());
    expect(second).toEqual(first);
  });

  it('produces the expected captured-listing distribution without State 1', async () => {
    const workspace = discoverOpportunities({
      snapshots: await capturedSnapshots(),
      candidate: sampleCandidate(),
      sessionId: TEST_SESSION_ID,
      candidateId: TEST_CANDIDATE_ID,
      source: 'snapshot_preview',
      sampleCandidate: true,
      now: NOW,
    });

    expect(workspace.jobs).toHaveLength(7);
    expect(workspace.jobs.map((job) => job.decision.state)).toEqual([
      'State_2',
      'State_2',
      'State_3',
      'State_4',
      'State_4',
      'State_4',
      'State_4',
    ]);
    expect(workspace.jobs.every((job) => job.fit_scores_5d.role_fit.status === 'assessed')).toBe(true);
    expect(workspace.jobs.every((job) => job.fit_scores_5d.evidence_strength.value === null)).toBe(true);
    expect(workspace.jobs.every((job) => job.fit_scores_5d.interview_readiness.value === null)).toBe(true);
    expect(workspace.jobs.some((job) => job.decision.state === 'State_1')).toBe(false);
  });

  it('keeps role fit separate from eligibility', async () => {
    const workspace = discoverOpportunities({
      snapshots: await capturedSnapshots(),
      candidate: sampleCandidate(),
      sessionId: TEST_SESSION_ID,
      candidateId: TEST_CANDIDATE_ID,
      source: 'snapshot_preview',
      sampleCandidate: true,
      now: NOW,
    });
    const sdet = workspace.jobs.find((job) => job.job.title.includes('Test II'));
    expect(sdet?.fit_scores_5d.role_fit.value).toBeGreaterThan(0);
    expect(sdet?.fit_scores_5d.eligibility.status).toBe('fail');
    expect(sdet?.decision.state).toBe('State_4');
  });
});
