'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  apiRequest,
  loadSession,
  startSession,
  type MutationResponse,
  type SessionViewResponse,
} from '@/lib/onboarding/client';
import { signalKey, signalStatus } from '@/lib/onboarding/taxonomy';
import {
  SIGNAL_CHAPTERS,
  SIGNAL_DEFINITIONS,
  getSignalDefinition,
  type SignalId,
  type SignalValue,
} from '@/types/phase4_contracts';

type Selection = string | readonly string[] | boolean | null;

function valueFromAnswer(value: SignalValue | undefined): Selection {
  if (value === undefined) return null;
  if (Array.isArray(value)) return [...value];
  return value;
}

function isSelected(selected: Selection, value: string): boolean {
  return Array.isArray(selected) ? selected.includes(value) : selected === value;
}

export function SignalsScreen() {
  const router = useRouter();
  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState<SignalId | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async (loaded) => {
        const next = loaded ?? (await startSession());
        if (!active) return;
        if (!next.session.consent.acknowledgedAt) {
          router.replace('/onboarding/consent');
          return;
        }
        if (next.session.completion) {
          router.replace('/onboarding/complete');
          return;
        }
        setView(next);
      })
      .catch(() => setError('Could not load the local draft.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const currentId = manualId ?? view?.nextSignalId ?? null;
  const definition = currentId ? getSignalDefinition(currentId) : null;

  useEffect(() => {
    if (!view || !definition) {
      setSelected(null);
      setTextValue('');
      return;
    }
    const existing = view.session.signals[signalKey(definition.id)]?.value;
    const next = valueFromAnswer(existing);
    setSelected(next);
    setTextValue(
      next === null
        ? ''
        : Array.isArray(next)
          ? next.join('\n')
          : typeof next === 'boolean'
            ? ''
            : String(next),
    );
  }, [view, definition]);

  const previousId = useMemo<SignalId | null>(() => {
    if (!view || !currentId) return null;
    const index = SIGNAL_DEFINITIONS.findIndex((signal) => signal.id === currentId);
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const signal = SIGNAL_DEFINITIONS[cursor];
      if (signalStatus(view.session, signal.id) !== 'unanswered') return signal.id;
    }
    return null;
  }, [view, currentId]);

  async function submitValue(value: unknown, skipped = false) {
    if (!view || !currentId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<MutationResponse>('/api/onboarding/signals', {
        method: 'PATCH',
        body: JSON.stringify(
          skipped
            ? { expectedRevision: view.session.revision, signalId: currentId, skip: true }
            : { expectedRevision: view.session.revision, signalId: currentId, value },
        ),
      });
      setView(response);
      setManualId(null);
      setSelected(null);
      setTextValue('');
      if (!response.nextSignalId) router.push('/onboarding/probe');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The answer was not saved.');
    } finally {
      setBusy(false);
    }
  }

  function autoSubmit(value: string | boolean) {
    setSelected(value);
    setBusy(true);
    window.setTimeout(() => void submitValue(value), 160);
  }

  function toggleMulti(value: string) {
    if (!definition) return;
    const current = Array.isArray(selected) ? selected : [];
    if (definition.exclusiveOption === value) {
      setSelected(current.includes(value) ? [] : [value]);
      return;
    }
    const withoutExclusive = current.filter((entry) => entry !== definition.exclusiveOption);
    if (withoutExclusive.includes(value)) {
      setSelected(withoutExclusive.filter((entry) => entry !== value));
      return;
    }
    const max = definition.maxSelections ?? 99;
    if (withoutExclusive.length >= max) return;
    setSelected([...withoutExclusive, value]);
  }

  if (loading) return <p className="text-sm text-ink-muted">Opening the signal stack…</p>;

  if (!view) {
    return (
      <div>
        <p className="text-sm text-ink-secondary">No local draft is open.</p>
        <Link
          href="/onboarding/consent"
          className="mt-4 inline-block text-xs text-ink-muted underline decoration-hairline underline-offset-4"
        >
          Return to consent
        </Link>
      </div>
    );
  }

  const chapter = definition
    ? SIGNAL_CHAPTERS.find((entry) => entry.id === definition.chapter)
    : null;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Screen 0.2 · 34 signals · one at a time
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SIGNAL_CHAPTERS.map((entry) => {
          const progress = view.chapterProgress[entry.id] ?? { resolved: 0, total: 1 };
          const active = definition?.chapter === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                const firstUnresolved =
                  entry.signalIds.find(
                    (signalId) => signalStatus(view.session, signalId) === 'unanswered',
                  ) ?? entry.signalIds[0];
                setManualId(firstUnresolved);
              }}
              aria-current={active ? 'step' : undefined}
              className={`rounded-pill border px-3 py-1.5 text-[10px] transition-colors ${
                active
                  ? 'border-obsidian bg-obsidian text-surface'
                  : 'border-hairline bg-surface text-ink-secondary hover:border-focus'
              }`}
            >
              {entry.label}
              <span className="ml-1.5 font-mono text-[9px] opacity-70">
                {progress.resolved}/{progress.total}
              </span>
            </button>
          );
        })}
      </div>

      {!definition ? (
        <section className="mt-12 border-t border-hairline pt-8">
          <h1 className="font-display text-3xl tracking-[-0.03em] text-ink-primary">
            All 34 signals are resolved.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-ink-secondary">
            The probe is a five-minute practice baseline. It does not represent an employer
            assessment.
          </p>
          <button
            type="button"
            onClick={() => router.push('/onboarding/probe')}
            className="mt-6 rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface"
          >
            Continue to the practice probe
          </button>
        </section>
      ) : (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {chapter?.label ?? definition.chapter} · Signal {String(definition.id)}
            </p>
            {definition.required ? null : (
              <span className="rounded-pill border border-hairline px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                Optional
              </span>
            )}
          </div>

          <h1 className="mt-4 max-w-2xl font-display text-[clamp(1.8rem,4vw,2.9rem)] font-normal leading-[1.05] tracking-[-0.035em] text-ink-primary">
            {definition.prompt}
          </h1>
          <p className="mt-4 max-w-xl border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
            <span className="font-medium text-ink-secondary">Why we ask: </span>
            {definition.why}
          </p>

          <div className="mt-8">
            {definition.control === 'single' ? (
              <div className="grid gap-2">
                {definition.options?.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={busy}
                    onClick={() => autoSubmit(option.value)}
                    aria-pressed={selected === option.value}
                    className={`flex items-center justify-between rounded-compact border px-4 py-3 text-left text-sm transition-colors ${
                      selected === option.value
                        ? 'border-obsidian bg-obsidian text-surface'
                        : 'border-hairline bg-surface text-ink-primary hover:border-focus'
                    }`}
                  >
                    <span>{option.label}</span>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-pill ${
                        selected === option.value ? 'bg-surface' : 'bg-hairline'
                      }`}
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {definition.control === 'boolean' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: 'Yes', value: true },
                  { label: 'No', value: false },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    disabled={busy}
                    onClick={() => autoSubmit(option.value)}
                    aria-pressed={selected === option.value}
                    className={`rounded-compact border px-4 py-3 text-sm transition-colors ${
                      selected === option.value
                        ? 'border-obsidian bg-obsidian text-surface'
                        : 'border-hairline bg-surface text-ink-primary hover:border-focus'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {definition.control === 'multi' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {definition.options?.map((option) => {
                    const active = isSelected(selected, option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleMulti(option.value)}
                        aria-pressed={active}
                        className={`rounded-pill border px-4 py-2 text-sm transition-colors ${
                          active
                            ? 'border-obsidian bg-obsidian text-surface'
                            : 'border-hairline bg-surface text-ink-primary hover:border-focus'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] text-ink-muted">
                  {definition.maxSelections
                    ? `Choose up to ${String(definition.maxSelections)}.`
                    : 'Choose any that apply.'}
                </p>
                <button
                  type="button"
                  disabled={busy || !Array.isArray(selected) || selected.length === 0}
                  onClick={() =>
                    void submitValue(Array.isArray(selected) ? selected : [])
                  }
                  className="mt-5 rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-surface disabled:opacity-40"
                >
                  Continue
                </button>
              </>
            ) : null}

            {definition.control === 'url' ? (
              <div>
                <input
                  type="url"
                  value={typeof selected === 'string' ? selected : textValue}
                  onChange={(event) => {
                    setTextValue(event.target.value);
                    setSelected(event.target.value);
                  }}
                  placeholder="https://"
                  className="w-full rounded-compact border border-hairline bg-surface px-4 py-3 text-sm text-ink-primary outline-none focus:border-focus"
                />
                <button
                  type="button"
                  disabled={busy || textValue.trim().length === 0}
                  onClick={() => void submitValue(textValue.trim())}
                  className="mt-4 rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-surface disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {definition.control === 'url_list' || definition.control === 'text' ? (
              <div>
                <textarea
                  value={textValue}
                  onChange={(event) =>
                    setTextValue(
                      event.target.value.slice(0, definition.maxChars ?? 1_000),
                    )
                  }
                  rows={definition.control === 'url_list' ? 4 : 5}
                  maxLength={definition.maxChars ?? 1_000}
                  placeholder={
                    definition.control === 'url_list' ? 'One URL per line' : 'Your answer'
                  }
                  className="w-full resize-y rounded-compact border border-hairline bg-surface p-4 text-sm leading-6 text-ink-primary outline-none focus:border-focus"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                    {textValue.length}/{definition.maxChars ?? 1_000}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void submitValue(
                        definition.control === 'url_list'
                          ? textValue
                              .split('\n')
                              .map((entry) => entry.trim())
                              .filter(Boolean)
                          : textValue.trim(),
                      )
                    }
                    className="rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-surface disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-5 border-t border-hairline pt-5">
            <button
              type="button"
              disabled={!previousId || busy}
              onClick={() => {
                if (previousId) setManualId(previousId);
              }}
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary disabled:opacity-40"
            >
              Previous
            </button>
            {!definition.required ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitValue(null, true)}
                className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary disabled:opacity-40"
              >
                Skip this question
              </button>
            ) : null}
            <span className="ml-auto text-[10px] text-ink-muted">
              {definition.required ? 'Required to finish intake' : 'You can skip this'}
            </span>
          </div>
        </section>
      )}

      {error ? (
        <p role="alert" className="mt-5 border-l-2 border-obsidian pl-3 text-xs leading-6 text-ink-secondary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
