import type { EmergencyOverrideState } from '@/types/phase7_contracts';

export function EmergencyOverrideBanner({ state }: { readonly state: EmergencyOverrideState }) {
  if (!state.active) return null;
  return (
    <div className="rounded-compact border border-hairline bg-surface px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
        Priority 1 emergency override
      </p>
      <p className="mt-1 text-[13px] text-ink-primary">
        {state.confirmed_company} {state.confirmed_role} {state.confirmed_round}
      </p>
      <p className="mt-1 text-[11px] text-ink-secondary">
        {String(state.backcalculated_hours)} hours remaining
      </p>
    </div>
  );
}
