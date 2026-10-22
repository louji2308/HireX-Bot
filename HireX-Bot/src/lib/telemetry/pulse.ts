import type { PulseLaneSnapshot } from '@/types/phase3_contracts';

/**
 * Honest initial state for Phase 3. No workflow has run, so every lane is
 * either not started or unavailable. Counts stay null rather than showing a
 * fabricated zero.
 */
export function getInitialPulseLanes(): readonly PulseLaneSnapshot[] {
  return [
    {
      lane: 'discovery',
      state: 'not_started',
      summary: 'Not started',
      count: null,
      observedAt: null,
      source: 'none',
    },
    {
      lane: 'application',
      state: 'not_started',
      summary: 'Not started',
      count: null,
      observedAt: null,
      source: 'none',
    },
    {
      lane: 'training',
      state: 'not_started',
      summary: 'Not started',
      count: null,
      observedAt: null,
      source: 'none',
    },
    {
      lane: 'local',
      state: 'unavailable',
      summary: 'Unavailable',
      count: null,
      observedAt: null,
      source: 'none',
    },
  ];
}
