
import { describe, expect, it } from 'vitest';

import type { LiveAgentReplayEvent } from '@/types/phase7_contracts';
import { isLiveAgentReplayEvent } from '@/lib/replay/live-agent-replay';

describe('Phase 7 live replay schema', () => {
  it('accepts a redacted keystroke event', () => {
    const event: LiveAgentReplayEvent = {
      event_type: 'keystroke_delta',
      session_id: 'session-1',
      candidate_id: 'candidate-1',
      occurred_at: '2026-10-25T12:00:00.000Z',
      payload: { delta: 'x', cursor: 1 },
    };
    expect(isLiveAgentReplayEvent(event)).toBe(true);
  });

  it('rejects an event with a secret-like payload', () => {
    const event = {
      event_type: 'keystroke_delta',
      session_id: 'session-1',
      candidate_id: 'candidate-1',
      occurred_at: '2026-10-25T12:00:00.000Z',
      payload: { token: 'sk-abcdefghijklmnopqrstuvwxyz' },
    };
    expect(isLiveAgentReplayEvent(event as LiveAgentReplayEvent)).toBe(false);
  });
});
