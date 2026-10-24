'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  apiRequest,
  loadSession,
  type ExtractResponse,
  type MutationResponse,
  type SessionViewResponse,
} from '@/lib/onboarding/client';
import { SYNTHETIC_SAMPLE_RESUME } from '@/lib/onboarding/sample-resume';
import type {
  CollegeTier,
  ExtractedField,
  ExtractionResult,
  SupportedLanguage,
} from '@/types/phase4_contracts';

const COLLEGE_TIERS: readonly { value: CollegeTier; label: string }[] = [
  { value: 'Tier_1', label: 'Tier 1' },
  { value: 'Tier_2', label: 'Tier 2' },
  { value: 'Tier_3', label: 'Tier 3' },
  { value: 'Rural', label: 'Rural' },
];

const LANGUAGES: readonly { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
];

function textFor(field: ExtractedField): string {
  if (field.value === null) return '';
  if (Array.isArray(field.value)) return field.value.join(', ');
  return String(field.value);
}

function statusLabel(field: ExtractedField): string {
  if (field.status === 'missing') return 'Missing';
  if (field.status === 'inferred') return 'Inferred';
  return 'Confirmed';
}

export function ExtractScreen({ sample }: { readonly sample: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'paste' | 'txt' | 'md'>('paste');
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [collegeTier, setCollegeTier] = useState<CollegeTier | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  useEffect(() => {
    let active = true;
    loadSession()
      .then((loaded) => {
        if (!active) return;
        setView(loaded);
        if (loaded?.session.extraction) {
          setExtraction(loaded.session.extraction);
          setFieldDrafts(
            Object.fromEntries(
              loaded.session.extraction.fields.map((field) => [field.key, textFor(field)]),
            ),
          );
        }
        setCollegeTier(loaded?.session.profile.collegeTier ?? null);
        setLanguage(loaded?.session.profile.preferredLanguage ?? 'en');
        if (sample && !loaded?.session.extraction) setText(SYNTHETIC_SAMPLE_RESUME);
      })
      .catch(() => setError('Could not load the local draft.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sample]);

  const fields = extraction?.fields ?? [];
  const resolvedCount = useMemo(
    () => fields.filter((field) => field.status !== 'missing').length,
    [fields],
  );

  async function onFile(file: File) {
    setError(null);
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (extension === 'pdf' || extension === 'docx' || extension === 'doc') {
      setError(
        'PDF/DOCX parsing is not connected in this build. Copy the text and paste it instead.',
      );
      return;
    }
    if (extension !== 'txt' && extension !== 'md') {
      setError('Use .txt, .md or paste the text.');
      return;
    }
    const content = await file.text();
    setText(content);
    setKind(extension);
    setSourceName(file.name);
  }

  async function extract() {
    if (text.trim().length < 20) {
      setError('Paste at least a few lines of resume text.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<ExtractResponse>('/api/onboarding/extract', {
        method: 'POST',
        body: JSON.stringify({ text, kind, sourceName }),
      });
      setView(result);
      setExtraction(result.extraction);
      setFieldDrafts(
        Object.fromEntries(result.extraction.fields.map((field) => [field.key, textFor(field)])),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Extraction did not complete.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmExtraction() {
    if (!view) {
      setError('Open the local draft again.');
      return;
    }
    if (!collegeTier) {
      setError('Choose your college tier. We never infer it.');
      return;
    }

    const patchFields: Record<string, string | readonly string[] | number | null> = {};
    for (const field of fields) {
      const draft = fieldDrafts[field.key] ?? '';
      if (Array.isArray(field.value)) {
        patchFields[field.key] = draft
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
      } else if (field.key === 'graduation_year' && draft.trim().length > 0) {
        const year = Number(draft);
        patchFields[field.key] = Number.isFinite(year) ? year : draft;
      } else {
        patchFields[field.key] = draft.trim().length > 0 ? draft.trim() : null;
      }
    }

    setBusy(true);
    setError(null);
    try {
      await apiRequest<MutationResponse>('/api/onboarding/session', {
        method: 'PATCH',
        body: JSON.stringify({
          expectedRevision: view.session.revision,
          review: {
            fields: patchFields,
            collegeTier,
            preferredLanguage: language,
          },
        }),
      });
      router.push('/onboarding/consent');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The review was not saved.');
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Opening the local draft…</p>;
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Screen 0.1 · Zero-redundancy intake
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4.4vw,3.2rem)] font-normal leading-[1.02] tracking-[-0.04em] text-ink-primary">
        Bring one source. We will only claim what it supports.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
        Paste resume text or upload a .txt/.md file. Each extracted field keeps its source and
        confidence. You review and correct everything before it is used.
      </p>

      {!extraction ? (
        <section className="mt-10 border-t border-hairline pt-8">
          <label htmlFor="resume-text" className="text-xs font-medium text-ink-primary">
            Resume text
          </label>
          <textarea
            id="resume-text"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 100_000))}
            rows={14}
            className="mt-3 w-full resize-y rounded-compact border border-hairline bg-surface p-4 font-mono text-[12px] leading-6 text-ink-primary outline-none focus:border-focus"
            placeholder="Paste the resume text here. A synthetic sample is available if you want to inspect the flow."
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-pill border border-hairline px-4 py-2 text-xs text-ink-secondary hover:border-focus hover:text-ink-primary"
              >
                Upload .txt or .md
              </button>
              <button
                type="button"
                onClick={() => {
                  setText(SYNTHETIC_SAMPLE_RESUME);
                  setKind('paste');
                  setSourceName('synthetic-sample.txt');
                }}
                className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
              >
                Load synthetic sample
              </button>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {text.length.toLocaleString()} / 100,000
            </span>
          </div>
          {sourceName ? (
            <p className="mt-3 text-[11px] text-ink-muted">Source: {sourceName}</p>
          ) : null}
          <p className="mt-4 border-l border-hairline pl-4 text-xs leading-6 text-ink-muted">
            Deterministic text extraction only. IBM Docling and semantic parsing are not connected
            in this build. Raw text is not stored after extraction.
          </p>
          <button
            type="button"
            onClick={() => void extract()}
            disabled={busy}
            className="mt-6 rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Extracting…' : 'Extract facts'}
          </button>
        </section>
      ) : (
        <section className="mt-10 border-t border-hairline pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl tracking-[-0.02em] text-ink-primary">
              Review the extraction
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {resolvedCount} of {fields.length} fields present
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-ink-muted">
            Confirmed means you corrected or accepted the value. Inferred means the extractor
            guessed. Missing means the source did not support the field.
          </p>

          <div className="mt-6 divide-y divide-hairline border-y border-hairline">
            {fields.map((field) => (
              <div key={field.key} className="grid gap-3 py-4 md:grid-cols-[10rem_1fr]">
                <div>
                  <label
                    htmlFor={`field-${field.key}`}
                    className="text-xs font-medium text-ink-primary"
                  >
                    {field.label}
                  </label>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                    {statusLabel(field)}
                  </p>
                </div>
                <div>
                  <input
                    id={`field-${field.key}`}
                    value={fieldDrafts[field.key] ?? ''}
                    onChange={(event) =>
                      setFieldDrafts((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-compact border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-focus"
                  />
                  <p className="mt-1 text-[10px] text-ink-muted">
                    {field.note ?? 'No note'} · source: {field.source}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="college-tier" className="text-xs font-medium text-ink-primary">
                College tier
              </label>
              <select
                id="college-tier"
                value={collegeTier ?? ''}
                onChange={(event) =>
                  setCollegeTier((event.target.value || null) as CollegeTier | null)
                }
                className="mt-2 w-full rounded-compact border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-focus"
              >
                <option value="">Choose one</option>
                {COLLEGE_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-ink-muted">
                You choose this. It is never inferred from the resume.
              </p>
            </div>
            <div>
              <label htmlFor="language" className="text-xs font-medium text-ink-primary">
                Preferred language
              </label>
              <select
                id="language"
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

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void confirmExtraction()}
              disabled={busy}
              className="rounded-pill bg-obsidian px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Saving review…' : 'Confirm and continue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setExtraction(null);
                setFieldDrafts({});
              }}
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
            >
              Use different text
            </button>
            <Link
              href="/onboarding/consent"
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
            >
              Continue without extraction
            </Link>
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
