import type { Blueprint } from '@/types/phase6_contracts';
import type { CalibrationMode, EmergencyOverrideState, OfflineContinuityState } from '@/types/phase7_contracts';
import { EmergencyOverrideBanner } from '@/components/studio/EmergencyOverrideBanner';
import { OfflineContinuityPill } from '@/components/studio/OfflineContinuityPill';

interface SimulationWorkspaceProps {
  readonly blueprint: Blueprint;
  readonly mode: CalibrationMode;
  readonly sessionId: string;
  readonly offlineState: OfflineContinuityState;
  readonly emergencyState?: EmergencyOverrideState;
}

export function SimulationWorkspace({
  blueprint,
  mode,
  sessionId,
  offlineState,
  emergencyState,
}: SimulationWorkspaceProps) {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="flex h-9 items-center justify-between rounded-compact border border-hairline bg-obsidian px-4 text-white">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">
          {mode} {blueprint.company_name} {blueprint.job_role}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">
          {sessionId}
        </span>
      </div>

      {emergencyState ? <div className="mt-4"><EmergencyOverrideBanner state={emergencyState} /></div> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <OfflineContinuityPill state={offlineState} />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          Preparation session
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[38%_62%]">
        <div className="rounded-bento border border-hairline bg-surface p-5 shadow-card">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Problem
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-ink-secondary">
            Company-calibrated practice problem. Hidden tests and reference solutions remain server-side.
          </p>
          {mode === 'Mode_A' ? (
            <div className="mt-5 rounded-compact border border-hairline bg-subtle p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Vernacular bridge
              </p>
              <p className="mt-2 text-[12px] text-ink-secondary">
                Native-language reasoning with a 60-second English pitch.
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-bento border border-hairline bg-surface p-5 shadow-card">
          <div className="rounded-compact border border-hairline bg-canvas p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Editor
            </p>
            <p className="mt-2 text-[12px] text-ink-secondary">Monaco editor surface</p>
          </div>

          <div className="mt-4 rounded-compact border border-hairline bg-subtle p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Piston console
            </p>
            <p className="mt-2 text-[12px] text-ink-secondary">Run and submit controls</p>
          </div>
        </div>
      </div>
    </section>
  );
}
