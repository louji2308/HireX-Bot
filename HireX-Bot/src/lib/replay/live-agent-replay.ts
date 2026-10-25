import type { LiveAgentReplayEvent } from '@/types/phase7_contracts';

function containsSecret(value: unknown): boolean {
  if (typeof value === 'string') return /sk-[A-Za-z0-9]{20,}/.test(value);
  if (Array.isArray(value)) return value.some(containsSecret);
  if (value && typeof value === 'object') return Object.values(value).some(containsSecret);
  return false;
}

export function isLiveAgentReplayEvent(value: LiveAgentReplayEvent): boolean {
  return (
    (value.event_type === 'keystroke_delta' || value.event_type === 'piston_run' || value.event_type === 'socratic_turn' || value.event_type === 'rubric_eval') &&
    typeof value.session_id === 'string' &&
    typeof value.candidate_id === 'string' &&
    typeof value.occurred_at === 'string' &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    !containsSecret(value.payload)
  );
}
