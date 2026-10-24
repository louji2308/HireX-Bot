import Link from 'next/link';

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 md:px-10">
        <Link
          href="/login"
          className="font-display text-base tracking-[-0.02em] text-ink-primary"
        >
          HireX Bot
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1 text-[10px] text-ink-secondary sm:inline-flex">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-ink-muted" />
            Local draft · not connected
          </span>
          <Link
            href="/login"
            className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
          >
            Exit
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-6 md:px-10">{children}</main>
    </div>
  );
}
