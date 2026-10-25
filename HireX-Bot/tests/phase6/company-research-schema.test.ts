import { describe, expect, it } from 'vitest';

import type { Blueprint, BlueprintInputs, CompanyResearch } from '@/types/phase6_contracts';
import { classifyEvidenceTier, normalizeEvidenceSource, researchCompany } from '@/agents/module5-blueprint/company-research';

const input = {
  company: 'Amazon',
  jobRole: 'Software Development Engineer',
  urls: ['https://www.amazon.jobs/en/jobs/123'],
};

describe('Phase 6 company research schema', () => {
  it('classifies an official documentation source as tier 2', () => {
    expect(classifyEvidenceTier({ origin: 'live_jina', url: 'https://www.amazon.jobs/en/jobs/123' })).toBe(2);
  });

  it('rejects non-HTTPS evidence URLs', () => {
    expect(() => normalizeEvidenceSource({
      tier: 2,
      label: 'Official docs',
      url: 'http://www.amazon.jobs/en/jobs/123',
      retrievedAt: '2026-10-24T12:00:00.000Z',
      excerpt: 'Example excerpt',
      origin: 'live_jina',
    })).toThrow();
  });

  it('returns a company research result with hashed HTTPS evidence', async () => {
    const fetcher = async () => ({ ok: true, text: async () => '# Amazon SDE\nRequirements...' });
    const result: CompanyResearch = await researchCompany(input, fetcher);
    expect(result.company).toBe('Amazon');
    expect(result.sources[0]?.url).toMatch(/^https:\/\//);
    expect(result.sources[0]?.content_sha256).toHaveLength(64);
    expect(result.live_verified).toBe(true);
  });
});

