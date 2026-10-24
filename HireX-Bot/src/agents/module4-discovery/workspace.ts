import {
  DECISION_STATES,
  PHASE5_CONTRACT_VERSION,
  PHASE5_LOCAL_NOTICE,
  PHASE5_SAMPLE_NOTICE,
  PHASE5_SNAPSHOT_NOTICE,
  type CandidateScoringInput,
  type DecisionCounts,
  type DecisionState,
  type DedupeReport,
  type OpportunityAssessment,
  type OpportunityBoardResponse,
  type OpportunitySnapshot,
  type OpportunityWorkspace,
} from '@/types/phase5_contracts';

import { assessOpportunity } from './assessment';
import { candidateLabel } from './candidate';
import { dedupeSnapshots } from './dedupe';

const STATE_RANK: Readonly<Record<DecisionState, number>> = {
  State_1: 1,
  State_2: 2,
  State_3: 3,
  State_4: 4,
};

export interface DiscoverInput {
  readonly snapshots: readonly OpportunitySnapshot[];
  readonly candidate: CandidateScoringInput;
  readonly sessionId: string;
  readonly candidateId: string;
  readonly source: OpportunityWorkspace['source'];
  readonly sampleCandidate: boolean;
  readonly now?: Date;
}

function sortAssessments(jobs: readonly OpportunityAssessment[]): OpportunityAssessment[] {
  return [...jobs].sort(
    (left, right) =>
      STATE_RANK[left.decision.state] - STATE_RANK[right.decision.state] ||
      right.fit_scores_5d.role_fit.value - left.fit_scores_5d.role_fit.value ||
      left.job.company.localeCompare(right.job.company) ||
      left.job.title.localeCompare(right.job.title),
  );
}

export function decisionCounts(jobs: readonly OpportunityAssessment[]): DecisionCounts {
  const counts: Record<DecisionState, number> = {
    State_1: 0,
    State_2: 0,
    State_3: 0,
    State_4: 0,
  };
  for (const job of jobs) counts[job.decision.state] += 1;
  return counts;
}

function noticesFor(sample: boolean): string[] {
  return [
    PHASE5_SNAPSHOT_NOTICE,
    PHASE5_LOCAL_NOTICE,
    'Role fit is declared skill overlap, not an employer assessment.',
    'Evidence strength and interview readiness are not assessed in Phase 5, so State 1 is unavailable.',
    'No application is submitted from this board.',
    ...(sample ? [PHASE5_SAMPLE_NOTICE] : []),
  ];
}

export function discoverOpportunities(input: DiscoverInput): OpportunityWorkspace {
  const now = input.now ?? new Date();
  const deduped = dedupeSnapshots(input.snapshots);
  const jobs = sortAssessments(
    deduped.snapshots.map((snapshot) =>
      assessOpportunity(snapshot, input.candidate, { now }),
    ),
  );

  return {
    version: 1,
    contractVersion: PHASE5_CONTRACT_VERSION,
    sessionId: input.sessionId,
    candidateId: input.candidateId,
    revision: 1,
    discoveredAt: now.toISOString(),
    candidateLabel: candidateLabel(input.sampleCandidate),
    sampleCandidate: input.sampleCandidate,
    source: input.source,
    live: false,
    jobs,
    notices: noticesFor(input.sampleCandidate),
    dedupe: deduped.report,
  };
}

function countFor(workspace: OpportunityWorkspace): DecisionCounts {
  return decisionCounts(workspace.jobs);
}

export function toBoardResponse(workspace: OpportunityWorkspace): OpportunityBoardResponse {
  return {
    version: 1,
    contractVersion: PHASE5_CONTRACT_VERSION,
    source: workspace.source,
    candidate_label: workspace.candidateLabel,
    synthetic_candidate: workspace.sampleCandidate,
    live: false,
    durable: false,
    discovered_at: workspace.discoveredAt,
    jobs: workspace.jobs,
    counts: countFor(workspace),
    notices: workspace.notices,
    dedupe: workspace.dedupe,
  };
}

export function withSavedState(
  workspace: OpportunityWorkspace,
  pipelineId: string,
  saved: boolean,
): OpportunityWorkspace | null {
  const index = workspace.jobs.findIndex((job) => job.pipeline_id === pipelineId);
  if (index === -1) return null;
  if (workspace.jobs[index]?.saved === saved) return workspace;

  const jobs = workspace.jobs.map((job, jobIndex) =>
    jobIndex === index ? { ...job, saved } : job,
  );
  return {
    ...workspace,
    revision: workspace.revision + 1,
    jobs,
  };
}

export function countsAreTotal(counts: DecisionCounts, total: number): boolean {
  return DECISION_STATES.reduce((sum, state) => sum + counts[state], 0) === total;
}

export function dedupeSummary(report: DedupeReport): string {
  if (report.input_count === report.unique_count) {
    return `${report.unique_count} unique captured listings.`;
  }
  return `${report.unique_count} unique listings from ${report.input_count} captured records.`;
}
