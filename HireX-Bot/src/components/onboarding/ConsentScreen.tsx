'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  apiRequest,
  loadSession,
  startSession,
  type MutationResponse,
  type SessionViewResponse,
} from '@/lib/onboarding/client';
import type {
  AutonomyLevel,
  CollegeTier,
  SupportedLanguage,
} from '@/types/phase4_contracts';

const TIERS: readonly CollegeTier[] = ['Tier_1', 'Tier_2', 'Tier_3', 'Rural'];
const LANGUAGES: readonly { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
];
const AUTONOMY: readonly { value: AutonomyLevel; label: string }[] = [
  { value: 1, label: 'Ask me before every external action' },
  { value: 2, label: 'Prepare drafts; ask before sending' },
  { value: 3, label: 'Act within a plan I approved' },
  { value: 4, label: 'Run the approved plan with checkpoints' },
];

export function ConsentScreen() {
  const router = useRouter();
  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [collegeTier, setCollegeTier] = useState<CollegeTier | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(2);

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async (loaded) => {
        const next = loaded ?? (await startSession());
        if (!active) return;
        setView(next);
        setCollegeTier(next.session.profile.collegeTier);
        setLanguage(next.session.profile.preferredLanguage);
        setAutonomy(next.session.profile.autonomyLevel);
        setAcknowledged(Boolean(next.session.consent.acknowledgedAt));
      })
      .catch(() => setError('Could not open the local draft.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function accept() {
    if (!view) return;
    if (!collegeTier) {
      setError('Choose your college tier before continuing.');
      return;
    }
    if (!acknowledged) {
      setError('Acknowledge the notice before continuing.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiRequest<MutationResponse>('/api/onboarding/consent', {
        method: 'PATCH',
        body: JSON.stringify({
          expectedRevision: view.session.revision,
          acknowledge: true,
          profile: {
            collegeTier,
            preferredLanguage: language,
            autonomyLevel: autonomy,
          },
        }),
      });
      router.push('/onboarding/signals');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Consent was not saved.');
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Opening the notice…</p>;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Screen 0.3 · Consent and workspace defaults
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.02] tracking-[-0.04em] text-ink-primary">
        You decide what this workspace may do.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
        Intake works without granting email access. Permissions are asked one at a time in the
        final chapter. This notice records the purpose, the minimum data, and how to erase the
        local draft.
      </p>

      <section className="mt-9 grid gap-6 border-y border-hairline py-7 md:grid-cols-2">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            What is stored
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-secondary">
            <li>Your answers, corrected extraction fields and consent choices.</li>
            <li>A local draft identifier in an httpOnly cookie.</li>
            <li>The probe result, labelled as a practice baseline.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            What is not stored or claimed
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-secondary">
            <li>Raw resume text after extraction.</li>
            <li>Any employer decision, placement or verified skill claim.</li>
            <li>Any email, application or message sent on your behalf.</li>
          </ul>
        </div>
      </section>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="consent-tier" className="text-xs font-medium text-ink-primary">
            College tier
          </label>
          <select
            id="consent-tier"
            value={collegeTier ?? ''}
            onChange={(event) => setCollegeTier((event.target.value || null) as CollegeTier | null)}
            className="mt-2 w-full rounded-compact border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-focus"
          >
            <option value="">Choose one</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="consent-language" className="text-xs font-medium text-ink-primary">
            Preferred language
          </label>
          <select
            id="consent-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
            className="mt-2 w-full rounded-compact border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-focus"
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-7">
        <label htmlFor="consent-autonomy" className="text-xs font-medium text-ink-primary">
          Autonomy level
        </label>
        <select
          id="consent-autonomy"
          value={autonomy}
          onChange={(event) => setAutonomy(Number(event.target.value) as AutonomyLevel)}
          className="mt-2 w-full rounded-compact border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-focus"
        >
          {AUTONOMY.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-ink-muted">
          This build has no external action to run. The setting is stored so a later phase can
          respect it.
        </p>
      </div>

      <label className="mt-8 flex items-start gap-3 border-t border-hairline pt-6 text-sm leading-6 text-ink-secondary">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#0A0A0B]"
        />
        <span>
          I have read this notice. I understand that I can revoke permissions, skip optional
          questions, and erase the local draft. This is product consent, not legal advice.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-4 border-l-2 border-obsidian pl-3 text-xs leading-6 text-ink-secondary">
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void accept()}
          disabled={busy}
          className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Acknowledge and continue'}
        </button>
        <Link
          href="/onboarding/extract"
          className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
        >
          Back to extraction
        </Link>
      </div>
    </div>
  );
}
