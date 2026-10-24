import { createHash } from 'node:crypto';

import type {
  CandidateScoringInput,
  DimensionScore,
  OpportunityAssessment,
  OpportunitySnapshot,
} from '@/types/phase5_contracts';

import { candidateFingerprint } from './candidate';
import { assessEligibility } from './eligibility';
import { scanOpportunityQuality } from './quality-scan';
import { routeOpportunity } from './router';
import { scoreRoleFit } from './role-fit';

export interface AssessOptions {
  readonly now?: Date;
  readonly saved?: boolean;
}

function notAssessed(
  reason: Extract<DimensionScore, { status: 'not_assessed' }>['reason'],
  detail: string,
): DimensionScore {
  return { status: 'not_assessed', value: null, reason, detail };
}

function pipelineId(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): string {
  const digest = createHash('sha256')
    .update(`${snapshot.source}:${snapshot.source_job_id}:${candidateFingerprint(candidate)}`)
    .digest('hex')
    .slice(0, 16);
  return `pipe_${digest}`;
}

export function assessOpportunity(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
  options: AssessOptions = {},
): OpportunityAssessment {
  const now = options.now ?? new Date();
  const eligibility = assessEligibility(snapshot, candidate, now);
  const roleFit = scoreRoleFit(snapshot.requirements, candidate);
  const quality = scanOpportunityQuality(snapshot.quality_excerpt);
  const evidenceStrength = notAssessed(
    'source_module_absent',
    'Module 2 portfolio analysis is not built. No evidence-strength score is invented.',
  );
  const interviewReadiness = notAssessed(
    'source_module_absent',
    'Module 5 interview simulation and Module 3 practice results are not available. No readiness score is invented.',
  );

  const decision = routeOpportunity({
    eligibility,
    role_fit: roleFit,
    evidence_strength: evidenceStrength,
    interview_readiness: interviewReadiness,
    opportunity_quality: quality,
  });

  const contentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

  return {
    pipeline_id: pipelineId(snapshot, candidate),
    job: snapshot,
    fit_scores_5d: {
      eligibility,
      role_fit: roleFit,
      evidence_strength: evidenceStrength,
      interview_readiness: interviewReadiness,
      opportunity_quality: quality,
    },
    decision,
    provenance: {
      source: snapshot.source,
      source_label:
        snapshot.source === 'greenhouse_public'
          ? 'Greenhouse public board'
          : snapshot.source === 'ashby_public'
            ? 'Ashby public posting API'
            : 'Synthetic fixture',
      source_url: snapshot.url,
      captured_at: snapshot.captured_at,
      source_updated_at: snapshot.source_updated_at,
      published_at: snapshot.published_at,
      valid_through: snapshot.valid_through,
      content_sha256: contentHash,
      capture_method: snapshot.capture_method,
      live: false,
      synthetic: snapshot.synthetic,
    },
    saved: options.saved ?? false,
  };
}
