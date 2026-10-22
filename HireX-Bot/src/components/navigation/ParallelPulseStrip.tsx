import { getInitialPulseLanes } from '@/lib/telemetry/pulse';
import type { PulseLaneId } from '@/types/phase3_contracts';

const LANE_LABELS: Record<PulseLaneId, string> = {
  discovery: 'Discovery',
  application: 'Applications',
  training: 'Training',
  local: 'Local',
};

function stateDotClass(state: string): string {
  if (state === 'completed') {
    return 'bg-obsidian';
  }

  if (state === 'running' || state === 'awaiting_approval' || state === 'requires_user_input') {
    return 'bg-ink-secondary';
  }

  return 'bg-hairline';
}

export function ParallelPulseStrip() {
  const lanes = getInitialPulseLanes();

  return (
    <section
      aria-label="Workflow activity"
      data-pulse-strip="true"
      className="pulse-scroll flex h-9 items-center gap-4 overflow-x-auto rounded-pill border border-hairline bg-surface px-4 shadow-card"
    >
      <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
        Parallel pulse
      </span>
      <div className="flex min-w-max items-center gap-4">
        {lanes.map((lane) => (
          <span
            key={lane.lane}
            data-pulse-lane={lane.lane}
            data-pulse-state={lane.state}
            className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-secondary"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-pill ${stateDotClass(lane.state)}`}
            />
            {LANE_LABELS[lane.lane]}
            <span className="text-ink-muted">{lane.summary}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
