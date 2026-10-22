import Link from 'next/link';

export default async function InterviewSessionPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        HireX Bot · Focus mode
      </p>
      <h1 className="mt-8 font-display text-[clamp(2rem,5vw,3rem)] font-normal leading-[1.08] tracking-[-0.03em] text-ink-primary">
        A focused session will open here.
      </h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-secondary">
        Company-calibrated interview simulation is not connected in this build. When it is, this
        view will keep the workspace quiet while you work through the session.
      </p>
      <div className="mt-10 rounded-bento border border-hairline bg-surface p-6 shadow-card">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          Session reference
        </p>
        <p className="mt-2 break-all font-mono text-xs text-ink-secondary">{id}</p>
      </div>
      <Link
        href="/interview"
        className="mt-8 inline-flex rounded-pill border border-hairline bg-surface px-4 py-2 text-sm text-ink-primary transition-colors hover:border-focus"
      >
        Return to Studio
      </Link>
    </div>
  );
}
