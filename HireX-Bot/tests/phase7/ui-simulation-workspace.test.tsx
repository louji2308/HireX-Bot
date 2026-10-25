import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DeltaReceiptCard } from '@/components/studio/DeltaReceiptCard';
import { SimulationWorkspace } from '@/components/studio/SimulationWorkspace';
import type { Blueprint } from '@/types/phase6_contracts';
import type { OfflineContinuityState } from '@/types/phase7_contracts';

const blueprint = {
  id: 'blueprint-1',
  candidate_id: null,
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  round_type: 'Coding',
  blueprint_version: 'v1.0',
  evaluation_criteria_weights: { correctness: 40, complexity: 25, code_quality: 20, explanation: 15 },
  question_distribution: { dsa: 60, system_design: 20, behavioral: 20 },
  duration_minutes: 45,
  confidence_tier: 'Verified — Official Documentation',
  source_urls: ['https://www.amazon.jobs/en/jobs/123'],
  visibility: 'shared',
  inputs: {} as never,
  created_at: '2026-10-25T12:00:00.000Z',
} as Blueprint;

const offline: OfflineContinuityState = {
  status: 'offline',
  latency_ms: 2600,
  queue_depth: 2,
  last_synced_at: null,
};

describe('Phase 7 simulation workspace', () => {
  it('renders the focus strip, split panes, and Mode A vernacular bridge', () => {
    const html = renderToStaticMarkup(
      <SimulationWorkspace blueprint={blueprint} mode="Mode_A" sessionId="session-1" offlineState={offline} />,
    );
    expect(html).toContain('h-9');
    expect(html).toContain('grid-cols-[38%_62%]');
    expect(html).toContain('Vernacular bridge');
    expect(html).toContain('Working offline - changes saved locally (2)');
    expect(html).toContain('Piston console');
  });

  it('does not render the vernacular bridge in Mode B', () => {
    const html = renderToStaticMarkup(
      <SimulationWorkspace blueprint={blueprint} mode="Mode_B" sessionId="session-1" offlineState={offline} />,
    );
    expect(html).not.toContain('Vernacular bridge');
  });
});

describe('Phase 7 delta receipt', () => {
  it('renders score, delta, and the Mode C mint action', () => {
    const html = renderToStaticMarkup(
      <DeltaReceiptCard weightedScore={4.2} baselineDelta={1.1} mode="Mode_C" canMint={true} />,
    );
    expect(html).toContain('4.2 / 5.0');
    expect(html).toContain('Delta +1.1');
    expect(html).toContain('Mint This Session to Your Public Skill Passport');
  });

  it('omits the mint action outside Mode C', () => {
    const html = renderToStaticMarkup(
      <DeltaReceiptCard weightedScore={4.2} baselineDelta={1.1} mode="Mode_B" canMint={true} />,
    );
    expect(html).not.toContain('Mint This Session to Your Public Skill Passport');
  });
});
