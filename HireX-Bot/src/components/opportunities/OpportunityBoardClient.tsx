'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type {
  OpportunityAssessment,
  OpportunityBoardResponse,
} from '@/types/phase5_contracts';

import {
  OpportunityBoardView,
  type OpportunityFilter,
} from '@/components/opportunities/OpportunityBoardView';

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
    ) {
      return payload.error.message;
    }
  } catch {
    // Fall through to a stable message.
  }
  return 'The opportunity workspace could not be loaded.';
}

function isBoard(value: unknown): value is OpportunityBoardResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'jobs' in value &&
    Array.isArray(value.jobs) &&
    'counts' in value &&
    typeof value.counts === 'object'
  );
}

export function OpportunityBoardClient() {
  const [board, setBoard] = useState<OpportunityBoardResponse | null>(null);
  const [activeState, setActiveState] = useState<OpportunityFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingPipelineId, setSavingPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      let response = await fetch('/api/opportunities', { cache: 'no-store' });
      if (response.status === 404) {
        response = await fetch('/api/opportunities/discover', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
      }
      if (!response.ok) {
        setError(await errorMessage(response));
        setBoard(null);
        return;
      }
      const payload: unknown = await response.json();
      if (!isBoard(payload)) {
        setError('The opportunity workspace returned an unsupported shape.');
        setBoard(null);
        return;
      }
      setBoard(payload);
      setActiveState('all');
    } catch {
      setError('The opportunity workspace could not be reached.');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSaved = useCallback(
    async (job: OpportunityAssessment) => {
      if (!board || board.synthetic_candidate) return;
      setSavingPipelineId(job.pipeline_id);
      setSaveError(null);
      try {
        const response = await fetch(
          `/api/opportunities/${encodeURIComponent(job.pipeline_id)}/save`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ saved: !job.saved }),
          },
        );
        if (!response.ok) {
          setSaveError(await errorMessage(response));
          if (response.status === 409) await load();
          return;
        }
        const payload: unknown = await response.json();
        if (!isBoard(payload)) {
          setSaveError('The saved state returned an unsupported shape.');
          return;
        }
        setBoard(payload);
      } catch {
        setSaveError('The role could not be saved locally.');
      } finally {
        setSavingPipelineId(null);
      }
    },
    [board, load],
  );

  if (loading) {
    return (
      <div aria-busy="true" className="mx-auto w-full max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Loading captured opportunities…
        </p>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-bento border border-hairline bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <section aria-labelledby="opportunities-error" className="mx-auto w-full max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Module 4 · Opportunity triage
        </p>
        <h1
          id="opportunities-error"
          className="mt-6 font-display text-[clamp(1.8rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.035em] text-ink-primary"
        >
          The opportunity board is not ready.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-secondary">{error}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex h-9 items-center rounded-pill bg-obsidian px-4 text-[11px] text-white"
          >
            Try again
          </button>
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center rounded-pill border border-hairline bg-surface px-4 text-[11px] text-ink-secondary"
          >
            Review intake
          </Link>
        </div>
      </section>
    );
  }

  return (
    <OpportunityBoardView
      board={board}
      activeState={activeState}
      onFilter={setActiveState}
      onToggleSaved={toggleSaved}
      canSave={!board.synthetic_candidate}
      savingPipelineId={savingPipelineId}
      saveError={saveError}
    />
  );
}
