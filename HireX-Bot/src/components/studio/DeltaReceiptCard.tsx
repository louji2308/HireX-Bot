interface DeltaReceiptCardProps {
  readonly weightedScore: number | null;
  readonly baselineDelta: number | null;
  readonly mode: 'Mode_A' | 'Mode_B' | 'Mode_C';
  readonly canMint: boolean;
}

export function DeltaReceiptCard({ weightedScore, baselineDelta, mode, canMint }: DeltaReceiptCardProps) {
  return (
    <section className="rounded-bento border border-hairline bg-surface p-6 shadow-card">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
        Immutable rubric delta receipt
      </h2>
      <p className="mt-3 text-[28px] font-medium text-ink-primary">
        {weightedScore === null ? 'Not graded' : `${weightedScore.toFixed(1)} / 5.0`}
      </p>
      <p className="mt-1 text-[12px] text-ink-secondary">
        {baselineDelta === null ? 'No comparable baseline' : `Delta ${baselineDelta >= 0 ? '+' : ''}${baselineDelta.toFixed(1)}`}
      </p>
      <div className="mt-5 grid gap-2">
        <div className="h-2 rounded-pill bg-subtle">
          <div className="h-2 w-2/3 rounded-pill bg-obsidian" />
        </div>
      </div>
      {mode === 'Mode_C' && canMint ? (
        <button type="button" className="mt-5 inline-flex h-9 items-center rounded-pill bg-obsidian px-4 text-[11px] text-white">
          Mint This Session to Your Public Skill Passport
        </button>
      ) : null}
    </section>
  );
}
