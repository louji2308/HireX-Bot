import { createHash } from 'node:crypto';

import type { CompanyResearch, ConfidenceTier, EvidenceSource, EvidenceTier } from '@/types/phase6_contracts';

interface RawEvidenceSource {
  readonly tier: EvidenceTier;
  readonly label: string;
  readonly url: string;
  readonly retrievedAt: string;
  readonly excerpt: string;
  readonly origin: 'live_jina' | 'cached' | 'seeded' | 'manual';
}

export function classifyEvidenceTier(source: { readonly origin: string; readonly url: string }): EvidenceTier {
  if (source.origin === 'live_jina' && source.url.startsWith('https://')) return 2;
  if (source.origin === 'cached') return 2;
  if (source.origin === 'manual') return 3;
  return 5;
}

export function normalizeEvidenceSource(raw: RawEvidenceSource): EvidenceSource {
  if (!raw.url.startsWith('https://')) throw new Error('Evidence URL must use HTTPS.');
  return {
    tier: raw.tier,
    label: raw.label,
    url: raw.url,
    retrieved_at: raw.retrievedAt,
    content_sha256: createHash('sha256').update(raw.excerpt).digest('hex'),
    excerpt: raw.excerpt,
  };
}

export async function researchCompany(
  input: { readonly company: string; readonly jobRole: string; readonly urls: readonly string[] },
  fetcher: (url: string) => Promise<{ readonly ok: boolean; text(): Promise<string> }>,
): Promise<CompanyResearch> {
  const sources: EvidenceSource[] = [];
  let liveVerified = false;
  for (const url of input.urls) {
    const response = await fetcher(url);
    if (!response.ok) continue;
    const text = await response.text();
    sources.push(normalizeEvidenceSource({
      tier: classifyEvidenceTier({ origin: 'live_jina', url }),
      label: 'Official documentation',
      url,
      retrievedAt: new Date().toISOString(),
      excerpt: text.slice(0, 500),
      origin: 'live_jina',
    }));
    liveVerified = true;
  }
  const confidenceTier: ConfidenceTier = sources.length > 0
    ? 'Verified - Official Documentation'
    : 'Company-Informed Simulation';
  return {
    company: input.company,
    confidence_tier: confidenceTier,
    sources,
    round_sequence: [],
    competency_weights: {},
    retrieved_at: new Date().toISOString(),
    source_mode: liveVerified ? 'live_jina' : 'seeded',
    live_verified: liveVerified,
  };
}
