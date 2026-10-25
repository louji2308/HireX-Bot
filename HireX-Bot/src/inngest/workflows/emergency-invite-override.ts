import type { EmergencyOverrideState } from '@/types/phase7_contracts';

export function createEmergencyOverride(input: {
  readonly candidateId: string;
  readonly company: string;
  readonly role: string;
  readonly round: string;
  readonly deadlineIso: string;
  readonly now: string;
}): EmergencyOverrideState {
  const deadline = new Date(input.deadlineIso).getTime();
  const now = new Date(input.now).getTime();
  const hours = Math.max(0, Math.ceil((deadline - now) / 3_600_000));
  return {
    active: true,
    priority: 1,
    confirmed_company: input.company,
    confirmed_role: input.role,
    confirmed_round: input.round,
    deadline_iso: input.deadlineIso,
    backcalculated_hours: hours,
    routine_paused: true,
    blueprint_id: null,
  };
}
