import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmergencyOverrideBanner } from '@/components/studio/EmergencyOverrideBanner';
import { createEmergencyOverride } from '@/inngest/workflows/emergency-invite-override';

describe('Phase 7 emergency override banner', () => {
  it('renders an active priority-one override', () => {
    const state = createEmergencyOverride({
      candidateId: '00000000-0000-4000-8000-000000000701',
      company: 'Amazon',
      role: 'Software Development Engineer',
      round: 'Coding',
      deadlineIso: '2026-11-10T12:00:00.000Z',
      now: '2026-10-25T12:00:00.000Z',
    });
    const html = renderToStaticMarkup(<EmergencyOverrideBanner state={state} />);
    expect(html).toContain('Priority 1 emergency override');
    expect(html).toContain('Amazon Software Development Engineer Coding');
  });

  it('renders nothing when inactive', () => {
    const html = renderToStaticMarkup(
      <EmergencyOverrideBanner state={{ ...createEmergencyOverride({
        candidateId: '00000000-0000-4000-8000-000000000701',
        company: 'Amazon',
        role: 'Software Development Engineer',
        round: 'Coding',
        deadlineIso: '2026-11-10T12:00:00.000Z',
        now: '2026-10-25T12:00:00.000Z',
      }), active: false }} />,
    );
    expect(html).toBe('');
  });
});
