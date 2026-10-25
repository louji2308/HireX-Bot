import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OfflineContinuityPill } from '@/components/studio/OfflineContinuityPill';

describe('Phase 7 offline continuity pill', () => {
  it('reports queued changes while offline', () => {
    const html = renderToStaticMarkup(
      <OfflineContinuityPill state={{ status: 'offline', latency_ms: 2600, queue_depth: 2, last_synced_at: null }} />,
    );
    expect(html).toContain('Working offline - changes saved locally (2)');
  });

  it('reports synced status', () => {
    const html = renderToStaticMarkup(
      <OfflineContinuityPill state={{ status: 'synced', latency_ms: 100, queue_depth: 0, last_synced_at: '2026-10-25T12:00:00.000Z' }} />,
    );
    expect(html).toContain('Changes synced');
  });
});
