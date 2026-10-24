'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  apiRequest,
  loadSession,
  type CompleteResponse,
  type FanOutPreviewCard,
  type SessionViewResponse,
} from '@/lib/onboarding/client';
import { buildLocalFanOutPreview } from '@/lib/onboarding/local-fanout';
import type { IntakeSession } from '@/types/phase4_contracts';

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CompleteScreen() {
  const router = useRouter();
  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [completion, setCompletion] = useState<IntakeSession['completion']>(null);
  const [fanOut, setFanOut] = useState<readonly FanOutPreviewCard[]>([]);
  const [delivery, setDelivery] = useState<CompleteResponse['delivery'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          router.replace('/onboarding/consent');
          return;
        }
        setView(loaded);
        if (loaded.session.completion) {
          setCompletion(loaded.session.completion);
          setFanOut(buildLocalFanOutPreview(loaded.session));
        }
      })
      .catch(() => setError('Could not load the local draft.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function complete() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<CompleteResponse>('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: view.session.revision }),
      });
      setView(response);
      setCompletion(response.completion);
      setFanOut(response.fanOutPreview);
      setDelivery(response.delivery);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Intake could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding/session', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('The local draft was not removed.');
      router.push('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The local draft was not removed.');
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Opening the local summary…</p>;

  if (!view) {
    return (
      <div>
        <p className="text-sm text-ink-secondary">No local draft is open.</p>
        <Link
          href="/login"
          className="mt-4 inline-block text-xs text-ink-muted underline decoration-hairline underline-offset-4"
        >
          Return to the start
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Screen 0.4 · Local completion
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.02] tracking-[-0.04em] text-ink-primary">
        {completion ? 'The intake draft is complete.' : 'Finish intake without pretending it is live.'}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
        The onboarding event is validated against the frozen schema. It is not sent to Inngest,
        Supabase or an employer in this build. The fan-out below is a local preview only.
      </p>

      {!completion ? (
        <section className="mt-9 border-y border-hairline py-7">
          <div className="grid gap-4 text-sm leading-6 text-ink-secondary">
            <p>
              Required signals resolved: {view.unresolvedRequiredSignals.length === 0 ? 'yes' : 'no'}
            </p>
            <p>Consent acknowledged: {view.session.consent.acknowledgedAt ? 'yes' : 'no'}</p>
            <p>Practice probe: {view.session.probe ? 'recorded' : 'not taken'}</p>
          </div>
          <button
            type="button"
            onClick={() => void complete()}
            disabled={busy || !view.canComplete}
            className="mt-6 rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface disabled:opacity-40"
          >
            {busy ? 'Completing…' : 'Complete intake locally'}
          </button>
          {!view.canComplete ? (
            <p className="mt-3 text-xs text-ink-muted">
              Finish the unresolved signals and consent first. The probe is optional.
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="mt-9 border-y border-hairline py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl tracking-[-0.02em] text-ink-primary">
                Completion record
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {completion.fanOut.source.replace('_', ' ')} · durable: no
              </span>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">College tier</dt>
                <dd className="mt-1 text-ink-primary">{completion.payload.college_tier}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Roles</dt>
                <dd className="mt-1 text-ink-primary">{completion.payload.target_roles.join(', ')}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Autonomy</dt>
                <dd className="mt-1 text-ink-primary">{completion.payload.autonomy_level}</dd>
              </div>
            </dl>
            <p className="mt-5 border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
              Event id: <span className="font-mono">{completion.eventId}</span>
              <br />
              {delivery?.reason ??
                'Validated locally. Inngest is not connected, so nothing was emitted or retried.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() =>
                  downloadJson('hirex-onboarding-summary.json', {
                    completion,
                    event: {
                      name: 'candidate/onboarding.completed',
                      payload: completion.payload,
                    },
                    delivery: delivery ?? {
                      emitted: false,
                      durable: false,
                      source: 'local_preview',
                    },
                  })
                }
                className="rounded-pill border border-hairline px-4 py-2 text-xs text-ink-secondary hover:border-focus hover:text-ink-primary"
              >
                Download local summary
              </button>
              <button
                type="button"
                onClick={() => void erase()}
                disabled={busy}
                className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
              >
                Delete local draft
              </button>
            </div>
          </section>

          <section className="mt-9">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Three-lane preview
            </h2>
            <div className="mt-4 grid gap-3">
              {fanOut.map((card) => (
                <article key={card.lane} className="rounded-compact border border-hairline bg-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium text-ink-primary">{card.title}</h3>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                      {card.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-secondary">{card.summary}</p>
                  <p className="mt-3 text-xs leading-6 text-ink-muted">{card.nextAction}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-9 flex flex-wrap items-center gap-5 border-t border-hairline pt-6">
            <Link
              href="/dashboard"
              className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface"
            >
              Open the workspace shell
            </Link>
            <Link
              href="/onboarding/signals"
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
            >
              Review signals
            </Link>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-5 border-l-2 border-obsidian pl-3 text-xs leading-6 text-ink-secondary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
