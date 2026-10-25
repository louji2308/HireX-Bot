
import { describe, expect, it } from 'vitest';

import type { EmergencyOverrideState } from '@/types/phase7_contracts';
import { createEmergencyOverride } from '@/inngest/workflows/emergency-invite-override';

describe('Phase 7 emergency invite override', () => {
  it('creates a priority-one back-calculated override and pauses routine training', () => {
    const state: EmergencyOverrideState = createEmergencyOverride({
      candidateId: '00000000-0000-4000-8000-000000000701',
      company: 'Amazon',
      role: 'Software Development Engineer',
      round: 'Coding',
      deadlineIso: '2026-11-10T12:00:00.000Z',
      now: '2026-10-25T12:00:00.000Z',
    });
    expect(state.active).toBe(true);
    expect(state.priority).toBe(1);
    expect(state.routine_paused).toBe(true);
    expect(state.backcalculated_hours).toBeGreaterThan(0);
    expect(state.confirmed_company).toBe('Amazon');
  });
});
