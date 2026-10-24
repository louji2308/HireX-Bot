'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function StartIntakeButton({
  hasDraft,
  sample = false,
}: {
  readonly hasDraft: boolean;
  readonly sample?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/onboarding/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      router.push(sample ? '/onboarding/extract?sample=1' : '/onboarding/extract');
    } catch {
      setError('Could not open a local draft. Try again.');
      setBusy(false);
    }
  }

  if (hasDraft) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push('/onboarding/signals')}
          className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90"
        >
          Resume local draft
        </button>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="text-left text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
        >
          Start a fresh draft instead
        </button>
        {error ? <p className="text-xs text-ink-secondary">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Opening local draft…' : 'Start intake without an account'}
      </button>
      {error ? <p className="text-xs text-ink-secondary">{error}</p> : null}
    </div>
  );
}
