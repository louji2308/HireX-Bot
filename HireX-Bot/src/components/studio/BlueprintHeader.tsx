import type { Blueprint, QCPipelineResult } from '@/types/phase6_contracts';

interface BlueprintHeaderProps {
  readonly blueprint: Blueprint;
  readonly qc: QCPipelineResult;
  readonly mode: 'A' | 'B' | 'C';
}

export function BlueprintHeader({ blueprint, qc, mode }: BlueprintHeaderProps) {
  return (
    <section className="rounded-compact border border-hairline bg-surface">
      <div className="flex h-[72px] items-center gap-2 rounded-pill border border-hairline bg-subtle px-4">
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Company</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Role</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Round</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Mode {mode}</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Language</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">Evidence</span>
        <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">QC</span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {blueprint.company_name} {blueprint.job_role}
          </p>
          <p className="mt-1 text-[13px] text-ink-secondary">{blueprint.confidence_tier}</p>
          <p className="mt-2 text-[11px] text-ink-secondary">
            {blueprint.source_urls[0]}
          </p>
        </div>
        <div className="flex items-start justify-end">
          <span className="rounded-pill border border-hairline bg-surface px-3 py-1 text-[11px] text-ink-secondary">
            {qc.final_status === 'released' ? '7/7 QC Checks Passed' : 'QC not released'}
          </span>
        </div>
      </div>
    </section>
  );
}
