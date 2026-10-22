import {
  NOT_CONNECTED_LABEL,
  WORKSPACE_COPY,
  WORKSPACE_EYEBROW,
} from '@/lib/ux/copy';
import type { NavTabId } from '@/types/phase3_contracts';

export function WorkspacePage({
  tab,
  children,
}: {
  readonly tab: NavTabId;
  readonly children?: React.ReactNode;
}) {
  const copy = WORKSPACE_COPY[tab];

  return (
    <div className="mx-auto w-full max-w-5xl">
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
          {copy.title}
        </h1>
        <p className="mt-5 text-[15px] leading-7 text-ink-secondary">{copy.description}</p>
      </header>

      {children ? <div className="mt-8">{children}</div> : null}

      <section className="mt-12 grid gap-8 border-t border-hairline pt-8 md:grid-cols-[12rem_1fr]">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          {copy.sectionLabel}
        </h2>
        <ul className="grid gap-3">
          {copy.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 border-b border-hairline pb-3 text-sm leading-6 text-ink-secondary last:border-b-0"
            >
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-obsidian" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 max-w-2xl border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
        {copy.closing}
      </p>
    </div>
  );
}
