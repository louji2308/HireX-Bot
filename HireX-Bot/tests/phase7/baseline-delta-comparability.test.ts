
import { describe, expect, it } from 'vitest';

import type { ComparableSessionKey } from '@/types/phase7_contracts';
import { calculateBaselineDelta } from '@/agents/module5-blueprint/baseline-delta';

const key: ComparableSessionKey = {
  candidate_id: '00000000-0000-4000-8000-000000000701',
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  round_type: 'Coding',
};

describe('Phase 7 baseline delta comparability', () => {
  it('compares only the exact candidate, company, role, and round tuple', () => {
    const result = calculateBaselineDelta({
      comparableKey: key,
      latestScore: 4.2,
      sessions: [
        { candidate_id: key.candidate_id, company_name: key.company_name, job_role: key.job_role, round_type: key.round_type, weighted_score: 3.1, id: 'baseline' },
        { candidate_id: key.candidate_id, company_name: 'Microsoft', job_role: key.job_role, round_type: key.round_type, weighted_score: 4.9, id: 'other-company' },
      ],
    });
    expect(result.comparable).toBe(true);
    expect(result.baseline_score).toBe(3.1);
    expect(result.delta).toBe(1.1);
    expect(result.baseline_session_id).toBe('baseline');
  });

  it('refuses a mismatched round tuple', () => {
    const result = calculateBaselineDelta({
      comparableKey: key,
      latestScore: 4.2,
      sessions: [
        { candidate_id: key.candidate_id, company_name: key.company_name, job_role: key.job_role, round_type: 'Behavioral', weighted_score: 3.1, id: 'wrong-round' },
      ],
    });
    expect(result.comparable).toBe(false);
    expect(result.baseline_score).toBeNull();
    expect(result.delta).toBeNull();
  });

  it('reports no comparable baseline instead of fabricating zero', () => {
    const result = calculateBaselineDelta({
      comparableKey: key,
      latestScore: 4.2,
      sessions: [],
    });
    expect(result.comparable).toBe(false);
    expect(result.baseline_score).toBeNull();
    expect(result.delta).toBeNull();
  });
});
