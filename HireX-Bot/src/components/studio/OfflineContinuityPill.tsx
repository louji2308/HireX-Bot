import type { OfflineContinuityState } from '@/types/phase7_contracts';

export function OfflineContinuityPill({ state }: { readonly state: OfflineContinuityState }) {
  const label =
    state.status === 'offline'
      ? 'Working offline - changes saved locally'
      : state.status === 'syncing'
        ? 'Syncing saved changes'
        : state.status === 'synced'
          ? 'Changes synced'
          : state.status === 'sync_failed'
            ? 'Sync failed - retrying'
            : 'Online';

  return (
    <span className="inline-flex items-center rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">
      {label}
      {state.queue_depth > 0 ? ` (${String(state.queue_depth)})` : ''}
    </span>
  );
}
