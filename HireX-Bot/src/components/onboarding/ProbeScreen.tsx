'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  apiRequest,
  loadSession,
  type ProbeResponse,
  type SessionViewResponse,
} from '@/lib/onboarding/client';
import type { PracticeProbe } from '@/lib/onboarding/probe';
import type {
  ProbeLanguage,
  ProbeResult,
} from '@/types/phase4_contracts';

const LANGUAGES: readonly { value: ProbeLanguage; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
];

interface ProbePayload {
  readonly probe: PracticeProbe;
  readonly revision: number;
}

export function ProbeScreen() {
  const router = useRouter();
  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [language, setLanguage] = useState<ProbeLanguage>('typescript');
  const [probe, setProbe] = useState<PracticeProbe | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async (loaded) => {
        if (!active) return;
        if (!loaded) {
          router.replace('/onboarding/consent');
          return;
        }
        if (!loaded.session.consent.acknowledgedAt) {
          router.replace('/onboarding/consent');
          return;
        }
        setView(loaded);
        if (loaded.session.probe) {
          setResult(loaded.session.probe);
          setLanguage(loaded.session.probe.language);
          setLoading(false);
          return;
        }
        const payload = await apiRequest<ProbePayload>('/api/onboarding/probe');
        if (!active) return;
        setProbe(payload.probe);
        setRevision(payload.revision);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError('Could not load the practice probe.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function changeLanguage(next: ProbeLanguage) {
    setLanguage(next);
    setChoice(null);
    setExplanation('');
    setError(null);
    try {
      const payload = await apiRequest<ProbePayload>(
        `/api/onboarding/probe?language=${encodeURIComponent(next)}`,
      );
      setProbe(payload.probe);
      setRevision(payload.revision);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load that language.');
    }
  }

  async function submit(skipped: boolean) {
    if (!view) return;
    if (!skipped && !choice) {
      setError('Choose one option, or skip the probe.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<ProbeResponse>('/api/onboarding/probe', {
        method: 'POST',
        body: JSON.stringify({
          expectedRevision: revision ?? view.session.revision,
          language,
          mcqChoice: skipped ? null : choice,
          explanation,
          skipped,
        }),
      });
      setResult(response.result);
      setView(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The probe result was not saved.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Preparing the practice probe…</p>;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Screen 0.4 · Code-ownership probe
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.02] tracking-[-0.04em] text-ink-primary">
        Explain code you can actually defend.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
        Five minutes, one short snippet, one explanation. This is a practice baseline, not an
        employer assessment. It is never presented as verified skill.
      </p>
      <p className="mt-3 inline-flex rounded-pill border border-hairline bg-surface px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
        Generic fallback · no repository excerpt connected
      </p>

      {result ? (
        <section className="mt-10 border-y border-hairline py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl tracking-[-0.03em] text-ink-primary">
              Probe recorded
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {result.verification.replace('_', ' ')}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Language</dt>
              <dd className="mt-1 text-ink-primary">{result.language}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Score</dt>
              <dd className="mt-1 text-ink-primary">
                {result.score === null ? 'Not scored' : `${String(result.score)} / 100`}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Method</dt>
              <dd className="mt-1 text-ink-primary">
                {result.scoreMethod === 'deterministic_keyword'
                  ? 'Deterministic keyword check'
                  : 'Not scored'}
              </dd>
            </div>
          </dl>
          <p className="mt-5 max-w-xl border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
            A keyword check cannot judge reasoning quality. Treat this as a prompt to practise,
            not a hiring signal.
          </p>
          <button
            type="button"
            onClick={() => router.push('/onboarding/complete')}
            className="mt-7 rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface"
          >
            Continue to the local summary
          </button>
        </section>
      ) : probe ? (
        <section className="mt-9">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void changeLanguage(option.value)}
                aria-pressed={language === option.value}
                className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                  language === option.value
                    ? 'border-obsidian bg-obsidian text-surface'
                    : 'border-hairline bg-surface text-ink-secondary hover:border-focus'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <pre className="mt-6 overflow-x-auto rounded-compact border border-hairline bg-surface p-5 font-mono text-[12px] leading-6 text-ink-primary">
            <code>{probe.code}</code>
          </pre>

          <div className="mt-7">
            <h2 className="text-sm font-medium text-ink-primary">{probe.question.prompt}</h2>
            <div className="mt-3 grid gap-2">
              {probe.question.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChoice(option.value)}
                  aria-pressed={choice === option.value}
                  className={`rounded-compact border px-4 py-3 text-left text-sm transition-colors ${
                    choice === option.value
                      ? 'border-obsidian bg-obsidian text-surface'
                      : 'border-hairline bg-surface text-ink-primary hover:border-focus'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <label htmlFor="probe-explanation" className="text-sm font-medium text-ink-primary">
              {probe.question.explanationPrompt}
            </label>
            <textarea
              id="probe-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value.slice(0, 2_000))}
              rows={5}
              className="mt-3 w-full resize-y rounded-compact border border-hairline bg-surface p-4 text-sm leading-6 text-ink-primary outline-none focus:border-focus"
              placeholder="Explain the failure and the smallest fix in your own words."
            />
            <p className="mt-1 text-right font-mono text-[9px] text-ink-muted">
              {explanation.length}/2,000
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={busy}
              className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Submit practice probe'}
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={busy}
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
            >
              Skip without a score
            </button>
            <Link
              href="/onboarding/signals"
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
            >
              Back to signals
            </Link>
          </div>
        </section>
      ) : (
        <p className="mt-8 text-sm text-ink-muted">No probe is available.</p>
      )}

      {error ? (
        <p role="alert" className="mt-5 border-l-2 border-obsidian pl-3 text-xs leading-6 text-ink-secondary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
