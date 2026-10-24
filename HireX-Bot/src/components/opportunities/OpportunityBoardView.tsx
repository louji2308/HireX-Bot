import Link from 'next/link';

import {
  DECISION_STATE_META,
  DECISION_STATES,
  type DecisionState,
  type OpportunityAssessment,
  type OpportunityBoardResponse,
} from '@/types/phase5_contracts';

export type OpportunityFilter = DecisionState | 'all';

export interface OpportunityBoardViewProps {
  readonly board: OpportunityBoardResponse;
  readonly activeState: OpportunityFilter;
  readonly onFilter: (state: OpportunityFilter) => void;
  readonly onToggleSaved: (job: OpportunityAssessment) => void;
  readonly canSave: boolean;
  readonly savingPipelineId?: string | null;
  readonly saveError?: string | null;
}

function readable(value: string): string {
  return value.replace(/_/g, ' ');
}

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : 'Not stated';
}

function stateBadgeClass(state: DecisionState): string {
  switch (state) {
    case 'State_1':
      return 'border-obsidian bg-obsidian text-white';
    case 'State_2':
      return 'border-obsidian bg-surface text-ink-primary';
    case 'State_3':
      return 'border-hairline bg-subtle text-ink-secondary';
    case 'State_4':
      return 'border-hairline bg-canvas text-ink-muted';
  }
}

function statusDot(state: DecisionState): string {
  switch (state) {
    case 'State_1':
      return 'bg-white';
    case 'State_2':
      return 'bg-obsidian';
    case 'State_3':
      return 'bg-ink-muted';
    case 'State_4':
      return 'border border-ink-muted bg-transparent';
  }
}

function FilterButton({
  filter,
  count,
  activeState,
  onFilter,
}: {
  readonly filter: OpportunityFilter;
  readonly count: number;
  readonly activeState: OpportunityFilter;
  readonly onFilter: (state: OpportunityFilter) => void;
}) {
  const selected = activeState === filter;
  const label = filter === 'all' ? 'All roles' : DECISION_STATE_META[filter].label;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onFilter(filter)}
      className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-pill border px-3.5 text-[12px] transition-colors ${
        selected
          ? 'border-obsidian bg-obsidian text-white'
          : 'border-hairline bg-surface text-ink-secondary hover:border-ink-muted hover:text-ink-primary'
      }`}
    >
      <span>{label}</span>
      <span
        className={`font-mono text-[10px] ${selected ? 'text-white/70' : 'text-ink-muted'}`}
      >
        {count}
      </span>
    </button>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: 'neutral' | 'boundary' | 'open' | 'unavailable';
}) {
  const toneClass =
    tone === 'boundary'
      ? 'border-ink-secondary bg-subtle text-ink-primary'
      : tone === 'open'
        ? 'border-obsidian bg-surface text-ink-primary'
        : tone === 'unavailable'
          ? 'border-dashed border-hairline bg-canvas text-ink-muted'
          : 'border-hairline bg-surface text-ink-secondary';
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[10px] ${toneClass}`}
    >
      <span className="font-mono uppercase tracking-[0.08em] text-ink-secondary">{label}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function EligibilityDetail({ job }: { readonly job: OpportunityAssessment }) {
  const { eligibility } = job.fit_scores_5d;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          Eligibility
        </h3>
        <span className="text-[11px] text-ink-secondary">{readable(eligibility.status)}</span>
      </div>
      <ul className="mt-2 grid gap-1.5">
        {eligibility.checks.map((check) => (
          <li
            key={check.id}
            className="grid grid-cols-[7.5rem_1fr] gap-2 text-[11px] leading-5 text-ink-secondary"
          >
            <span className="text-ink-muted">{check.label}</span>
            <span>
              <span className="font-medium text-ink-primary">{readable(check.status)}.</span>{' '}
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
      {eligibility.warnings.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-[11px] leading-5 text-ink-muted">
          {eligibility.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SkillList({
  label,
  values,
  empty,
}: {
  readonly label: string;
  readonly values: readonly string[];
  readonly empty: string;
}) {
  return (
    <div>
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
        {values.length > 0 ? values.join(', ') : empty}
      </p>
    </div>
  );
}

function fitTone(status: string): 'open' | 'boundary' | 'neutral' {
  if (status === 'pass') return 'open';
  if (status === 'fail') return 'boundary';
  return 'neutral';
}

function OpportunityCard({
  job,
  onToggleSaved,
  canSave,
  saving,
}: {
  readonly job: OpportunityAssessment;
  readonly onToggleSaved: (job: OpportunityAssessment) => void;
  readonly canSave: boolean;
  readonly saving: boolean;
}) {
  const { decision, fit_scores_5d: fit } = job;
  const meta = DECISION_STATE_META[decision.state];
  const qualityTone =
    fit.opportunity_quality.status === 'fail'
      ? 'boundary'
      : fit.opportunity_quality.status === 'needs_review'
        ? 'neutral'
        : 'open';
  const qualityLabel =
    fit.opportunity_quality.status === 'fail'
      ? 'Fee phrase found'
      : fit.opportunity_quality.status === 'needs_review'
        ? 'Human check'
        : 'No fee phrase';

  return (
    <article
      className="flex flex-col rounded-bento border border-hairline bg-surface p-4 shadow-card"
      data-pipeline-id={job.pipeline_id}
      data-state={decision.state}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
            {job.job.company}
          </p>
          <h2 className="mt-1 text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink-primary">
            {job.job.title}
          </h2>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[10px] ${stateBadgeClass(decision.state)}`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${statusDot(decision.state)}`} />
          {meta.label}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-ink-muted">
        {job.job.location_text} · {readable(job.job.work_modes.join(' / '))} ·{' '}
        {readable(job.job.employment_type)}
      </p>

      <p className="mt-3 line-clamp-3 text-[12px] leading-5 text-ink-secondary">
        {decision.explanation}
      </p>

      {decision.requires_confirmation ? (
        <p className="mt-2 border-l border-obsidian pl-2 text-[11px] leading-5 text-ink-primary">
          Check the source before applying; a hard requirement is not confirmed from the captured text.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill
          label="Fit"
          value={`${String(fit.role_fit.value)}/100`}
          tone={fit.role_fit.value >= 65 ? 'open' : 'neutral'}
        />
        <Pill
          label="Eligibility"
          value={readable(fit.eligibility.status)}
          tone={fitTone(fit.eligibility.status)}
        />
        <Pill
          label="Evidence"
          value={
            fit.evidence_strength.status === 'assessed'
              ? `${String(fit.evidence_strength.value)}/100`
              : 'Not assessed'
          }
          tone="unavailable"
        />
        <Pill
          label="Readiness"
          value={
            fit.interview_readiness.status === 'assessed'
              ? `${String(fit.interview_readiness.value)}/100`
              : 'Not assessed'
          }
          tone="unavailable"
        />
        <Pill label="Quality" value={qualityLabel} tone={qualityTone} />
      </div>

      <details className="group mt-3 border-t border-hairline pt-3">
        <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink-primary">
          <span className="inline-flex items-center gap-1.5">
            Inspect five dimensions
            <span aria-hidden="true" className="transition-transform group-open:rotate-45">
              +
            </span>
          </span>
        </summary>

        <div className="mt-3 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SkillList
              label="Core matched"
              values={fit.role_fit.core_matched}
              empty="No core skill overlap"
            />
            <SkillList
              label="Core gaps"
              values={fit.role_fit.core_missing}
              empty="No core gaps in the declared set"
            />
            <SkillList
              label="Preferred matched"
              values={fit.role_fit.preferred_matched}
              empty="No preferred overlap"
            />
            <SkillList
              label="Preferred gaps"
              values={fit.role_fit.preferred_missing}
              empty="No preferred gaps"
            />
          </div>

          <p className="border-l border-hairline pl-3 text-[11px] leading-5 text-ink-muted">
            {fit.role_fit.label}. This is a declared-skill comparison, not proof of ability or an
            employer assessment.
          </p>

          <EligibilityDetail job={job} />

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Evidence strength
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
                {fit.evidence_strength.status === 'assessed'
                  ? `${String(fit.evidence_strength.value)}/100 · ${fit.evidence_strength.label}`
                  : fit.evidence_strength.detail}
              </p>
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Interview readiness
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
                {fit.interview_readiness.status === 'assessed'
                  ? `${String(fit.interview_readiness.value)}/100 · ${fit.interview_readiness.label}`
                  : fit.interview_readiness.detail}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Opportunity quality
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
              {fit.opportunity_quality.note}
            </p>
            {fit.opportunity_quality.findings.length > 0 ? (
              <ul className="mt-2 grid gap-1.5">
                {fit.opportunity_quality.findings.map((finding) => (
                  <li
                    key={`${finding.rule_id}-${finding.quote}`}
                    className="rounded-compact border border-hairline bg-subtle px-2.5 py-2 text-[11px] leading-5 text-ink-secondary"
                  >
                    <span className="font-medium text-ink-primary">{finding.label}:</span>{' '}
                    “{finding.quote}”
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </details>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-hairline pt-3">
        <div className="min-w-0 text-[10px] leading-4 text-ink-muted">
          <p>
            {job.provenance.source_label} · captured {shortDate(job.provenance.captured_at)}
          </p>
          <p>
            Source date {shortDate(job.provenance.source_updated_at ?? job.provenance.published_at)}
            {job.job.valid_through ? ` · valid through ${shortDate(job.job.valid_through)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={job.provenance.source_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center rounded-pill border border-hairline bg-surface px-3 text-[11px] text-ink-secondary transition-colors hover:border-ink-muted hover:text-ink-primary"
          >
            Source listing
          </a>
          {canSave ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onToggleSaved(job)}
              aria-label={job.saved ? `Remove ${job.job.title} from saved roles` : `Save ${job.job.title}`}
              className="inline-flex h-8 items-center rounded-pill border border-obsidian bg-obsidian px-3 text-[11px] text-white transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : job.saved ? 'Saved' : 'Save role'}
            </button>
          ) : (
            <Link
              href="/onboarding/consent"
              className="inline-flex h-8 items-center rounded-pill border border-hairline bg-surface px-3 text-[11px] text-ink-secondary transition-colors hover:border-ink-muted hover:text-ink-primary"
            >
              Finish intake to save
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function OpportunityBoardView({
  board,
  activeState,
  onFilter,
  onToggleSaved,
  canSave,
  savingPipelineId = null,
  saveError = null,
}: OpportunityBoardViewProps) {
  const filtered =
    activeState === 'all' ? board.jobs : board.jobs.filter((job) => job.decision.state === activeState);
  const total = board.jobs.length;
  const countFor = (filter: OpportunityFilter): number =>
    filter === 'all' ? total : board.counts[filter];

  return (
    <section aria-labelledby="opportunities-heading" className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Module 4 · Opportunity triage
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1 text-[10px] text-ink-secondary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-ink-muted" />
          Captured snapshots · not live
        </span>
      </div>

      <header className="mt-6 max-w-3xl">
        <h1
          id="opportunities-heading"
          className="font-display text-[clamp(1.8rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.035em] text-ink-primary"
        >
          Roles you can inspect before applying.
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-ink-secondary">
          {board.candidate_label}. Five dimensions stay separate: eligibility, declared role fit,
          evidence strength, interview readiness, and opportunity quality. Missing evidence is
          reported as missing, not as low ability.
        </p>
      </header>

      {board.synthetic_candidate ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-compact border border-dashed border-hairline bg-surface px-3.5 py-3">
          <p className="max-w-2xl text-[11px] leading-5 text-ink-secondary">
            This is a sample-candidate preview. Finish your local intake to assess the same captured
            listings against your own boundaries.
          </p>
          <Link
            href="/onboarding/consent"
            className="inline-flex h-8 shrink-0 items-center rounded-pill bg-obsidian px-3 text-[11px] text-white"
          >
            Finish intake
          </Link>
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1.5" role="group" aria-label="Filter by routing state">
          <FilterButton
            filter="all"
            count={countFor('all')}
            activeState={activeState}
            onFilter={onFilter}
          />
          {DECISION_STATES.map((state) => (
            <FilterButton
              key={state}
              filter={state}
              count={countFor(state)}
              activeState={activeState}
              onFilter={onFilter}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-muted">
        <p>
          {filtered.length} of {total} roles shown · {board.dedupe.unique_count} unique captured
          listings
        </p>
        <p>
          {board.live ? 'Live data' : 'Snapshot data'} · {board.durable ? 'Durable' : 'Local only'}
        </p>
      </div>

      {saveError ? (
        <p role="alert" className="mt-3 border-l border-obsidian pl-3 text-[11px] text-ink-primary">
          {saveError}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-bento border border-dashed border-hairline bg-surface px-5 py-10 text-center">
          <p className="text-sm text-ink-secondary">No captured roles in this route.</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            Choose another state or inspect all roles.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {filtered.map((job) => (
            <OpportunityCard
              key={job.pipeline_id}
              job={job}
              onToggleSaved={onToggleSaved}
              canSave={canSave}
              saving={savingPipelineId === job.pipeline_id}
            />
          ))}
        </div>
      )}

      <details className="mt-6 border-t border-hairline pt-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          How this board works
        </summary>
        <ul className="mt-3 grid gap-1.5 text-[11px] leading-5 text-ink-secondary">
          {board.notices.map((notice) => (
            <li key={notice} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-obsidian" />
              {notice}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-5 text-ink-muted">
          State 1 stays unavailable until Module 2 evidence and Module 5 readiness produce measured
          scores. There is no apply action in this build.
        </p>
      </details>
    </section>
  );
}
