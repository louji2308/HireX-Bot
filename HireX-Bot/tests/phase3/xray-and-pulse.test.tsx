import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ParallelPulseStrip } from '@/components/navigation/ParallelPulseStrip';
import { JudgeXRayInspector } from '@/components/telemetry/JudgeXRayInspector';
import { getPhase3ProvenanceEntries } from '@/lib/telemetry/provenance';
import { getInitialPulseLanes } from '@/lib/telemetry/pulse';

describe('Judge Inspector', () => {
  it('starts closed and does not render invented runtime values', () => {
    const html = renderToStaticMarkup(<JudgeXRayInspector />);

    expect(html).toContain('Judge Inspector · Off');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-controls="judge-xray-panel"');
    expect(html).not.toContain('data-xray-panel');
    expect(html).not.toContain('No table read');
    expect(html).not.toContain('Not invoked on this route');
  });

  it('labels provenance as static or unavailable rather than live', () => {
    const entries = getPhase3ProvenanceEntries();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(['static', 'unavailable']).toContain(entry.source);
      expect(entry.observedAt).toBeNull();
      expect(entry.value.toLowerCase()).not.toContain('latency');
      expect(entry.value.toLowerCase()).not.toContain('ms');
    }

    expect(entries.find((entry) => entry.id === 'functions')?.value).toBe('0 in this build');
    expect(entries.find((entry) => entry.id === 'run')?.value).toBe('No run in this build');
  });
});

describe('parallel pulse strip', () => {
  it('renders four honest lanes with no fabricated counts', () => {
    const html = renderToStaticMarkup(<ParallelPulseStrip />);
    const lanes = getInitialPulseLanes();

    expect(lanes).toHaveLength(4);
    expect(html.match(/data-pulse-lane=/g)).toHaveLength(4);
    for (const lane of lanes) {
      expect(lane.count).toBeNull();
      expect(html).toContain(`data-pulse-state="${lane.state}"`);
    }
    expect(html).toContain('Not started');
    expect(html).toContain('Unavailable');
    expect(html).not.toMatch(/>\s*0\s*</);
    expect(html).toContain('h-9');
  });
});
