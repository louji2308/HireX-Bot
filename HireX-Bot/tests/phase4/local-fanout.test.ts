import { describe, expect, it } from 'vitest';

import { buildLocalFanOutPreview } from '@/lib/onboarding/local-fanout';
import { deriveIntakeDiagnostics } from '@/lib/onboarding/taxonomy';
import { readyToComplete } from './fixtures';

describe('Phase 4 local fan-out preview', () => {
  it('returns three clearly local lanes without claiming delivery', () => {
    const session = readyToComplete();
    const lanes = buildLocalFanOutPreview(session);

    expect(lanes.map((lane) => lane.lane)).toEqual([
      'discovery',
      'application_prep',
      'training',
    ]);
    expect(lanes.every((lane) => lane.status === 'preview')).toBe(true);
    expect(lanes[0]?.summary).toContain('Backend SDE');
    expect(lanes[2]?.summary).toContain('zero-cost');
  });

  it('does not invent evidence when no extraction exists', () => {
    const lanes = buildLocalFanOutPreview(readyToComplete());
    expect(lanes[1]?.summary).toContain('No resume fields were extracted');
  });

  it('uses the same FR-105 diagnostics as the signal stack', () => {
    const session = readyToComplete();
    expect(deriveIntakeDiagnostics(session)).toMatchObject({ bottleneck: true, freeOnly: true });
  });
});
