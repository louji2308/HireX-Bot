'use client';

import { useState } from 'react';

import { HollowIcon } from '@/components/ui/HollowIcon';
import { getPhase3ProvenanceEntries } from '@/lib/telemetry/provenance';

export function JudgeXRayInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const entries = getPhase3ProvenanceEntries();

  return (
    <div className="fixed bottom-24 left-4 z-40 md:bottom-4">
      {isOpen ? (
        <section
          id="judge-xray-panel"
          aria-label="Judge Inspector provenance"
          data-xray-panel="true"
          className="absolute bottom-full left-0 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-bento border border-hairline bg-surface shadow-navbar"
        >
          <div className="border-b border-hairline px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              Judge Inspector
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              Static provenance for this build. No live model or workflow trace is available.
            </p>
          </div>
          <dl className="divide-y divide-hairline">
            {entries.map((entry) => (
              <div
                key={entry.id}
                data-provenance-id={entry.id}
                data-provenance-source={entry.source}
                className="grid grid-cols-[7rem_1fr] gap-2 px-4 py-2.5"
              >
                <dt className="text-[11px] text-ink-muted">{entry.label}</dt>
                <dd className="font-mono text-[11px] leading-5 text-ink-primary">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <button
        type="button"
        data-xray-toggle="true"
        aria-label={`Judge Inspector, ${isOpen ? 'on' : 'off'}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'judge-xray-panel' : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-9 items-center gap-2 rounded-pill border border-hairline bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary shadow-card transition-colors hover:border-focus hover:text-ink-primary"
      >
        <HollowIcon name="inspector" size={14} strokeWidth={1.35} />
        <span className="hidden sm:inline">Judge Inspector · {isOpen ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
