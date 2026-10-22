import { NOT_CONNECTED_LABEL, WORKSPACE_EYEBROW } from '@/lib/ux/copy';

const PLANNED_CONTROLS = [
  'An autonomy level with the exact actions it permits',
  'Consent records that show purpose, scope, and revocation',
  'An erase request status tied to the data-governance contract',
] as const;

export default function GovernancePage() {
  return (
    <div data-governance-page="true" className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          {WORKSPACE_EYEBROW}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1 text-[10px] text-ink-secondary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-ink-muted" />
          {NOT_CONNECTED_LABEL}
        </span>
      </div>

      <header className="mt-10 max-w-2xl">
        <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.035em] text-ink-primary">
          Autonomy and consent, before anything leaves your hands.
        </h1>
        <p className="mt-5 text-[15px] leading-7 text-ink-secondary">
          This page will hold the candidate-facing governance controls for autonomy, consent, and
          erasure. None of those controls are active in this build.
        </p>
      </header>

      <section className="mt-12 grid gap-8 border-t border-hairline pt-8 md:grid-cols-[12rem_1fr]">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Planned controls
        </h2>
        <ul className="grid gap-3">
          {PLANNED_CONTROLS.map((control) => (
            <li
              key={control}
              className="flex items-start gap-3 border-b border-hairline pb-3 text-sm leading-6 text-ink-secondary last:border-b-0"
            >
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-obsidian" />
              {control}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 max-w-2xl border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
        No application, message, or external commitment is sent from this build. A future control
        must record who approved an action, what was approved, and when it happened.
      </p>
    </div>
  );
}
