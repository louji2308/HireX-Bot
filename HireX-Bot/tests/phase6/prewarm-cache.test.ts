import { describe, expect, it } from 'vitest';

import type { BlueprintInputs } from '@/types/phase6_contracts';
import { bundleCacheKey, resolvePreWarmedBundle } from '@/agents/module5-blueprint/qc-pipeline';

const input: BlueprintInputs = {
  company: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  selected_round: 'Coding',
  expected_format: 'live_coding',
  candidate_capability: {
    weak_topics: [],
    strong_topics: ['dsa'],
    completed_sessions: 0,
    last_weighted_score: null,
    declared_skills: ['typescript'],
  },
  interview_deadline: null,
};

describe('Phase 6 pre-warm cache', () => {
  it('creates a stable cache key from blueprint inputs', () => {
    expect(bundleCacheKey(input)).toBe(bundleCacheKey({ ...input }));
  });

  it('resolves a cached bundle without regenerating it', () => {
    const cache = new Map<string, { bundleId: string }>();
    const key = bundleCacheKey(input);
    cache.set(key, { bundleId: 'bundle-1' });
    expect(resolvePreWarmedBundle(cache, key)).toEqual({ bundleId: 'bundle-1' });
  });

  it('returns null for a cache miss', () => {
    const cache = new Map<string, { bundleId: string }>();
    expect(resolvePreWarmedBundle(cache, bundleCacheKey(input))).toBeNull();
  });
});
