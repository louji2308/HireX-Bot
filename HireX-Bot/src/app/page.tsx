const FOUNDATION_TOKENS = [
  { label: 'Canvas', value: '#FAFAFA', swatch: 'bg-canvas', ring: true },
  { label: 'Surface', value: '#FFFFFF', swatch: 'bg-surface', ring: true },
  { label: 'Subtle', value: '#F4F4F5', swatch: 'bg-subtle', ring: false },
  { label: 'Obsidian', value: '#0A0A0B', swatch: 'bg-obsidian', ring: false },
  { label: 'Hairline', value: '#E4E4E7', swatch: 'bg-hairline', ring: false },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.03em] text-ink-muted">
          Phase 1 &middot; Cognitive Swarm Foundation
        </p>
        <h1 className="font-display text-[32px] font-light leading-[1.2] tracking-[-0.03em] text-ink-primary">
          HireX Bot
        </h1>
        <p className="max-w-xl font-sans text-[14px] leading-[1.55] text-ink-secondary">
          Monochrome foundation verified. Route discovery, proof-of-work and
          company-calibrated preparation will connect here.
        </p>
      </header>

      <section
        aria-label="Design tokens"
        className="rounded-stage border border-hairline bg-surface p-6 shadow-card"
      >
        <h2 className="mb-5 font-display text-[20px] font-normal tracking-[-0.025em] text-ink-primary">
          Obsidian on Alabaster
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FOUNDATION_TOKENS.map((token) => (
            <li key={token.label} className="space-y-2">
              <span
                aria-hidden="true"
                className={`block h-12 w-full rounded-compact ${token.swatch} ${
                  token.ring ? 'border border-hairline' : ''
                }`}
              />
              <span className="block font-sans text-[11.5px] font-medium tracking-[0.03em] text-ink-secondary">
                {token.label}
              </span>
              <span className="block font-mono text-[12px] text-ink-muted">
                {token.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
