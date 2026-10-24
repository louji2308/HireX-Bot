import type { Database, Json } from '@/types/database.types';
import type { OpportunityAssessment } from '@/types/phase5_contracts';

export type EmploymentPipelineInsert =
  Database['public']['Tables']['employment_pipeline_events']['Insert'];

export type PipelineRowErrorCode =
  | 'synthetic_opportunity'
  | 'invalid_candidate_id'
  | 'invalid_row_fields';

export class PipelineRowError extends Error {
  readonly code: PipelineRowErrorCode;

  constructor(code: PipelineRowErrorCode, message: string) {
    super(message);
    this.name = 'PipelineRowError';
    this.code = code;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toEmploymentPipelineRow(
  assessment: OpportunityAssessment,
  candidateId: string,
): EmploymentPipelineInsert {
  if (!UUID_PATTERN.test(candidateId)) {
    throw new PipelineRowError(
      'invalid_candidate_id',
      'A persisted pipeline row requires a real candidate UUID.',
    );
  }

  if (assessment.provenance.synthetic || assessment.job.synthetic) {
    throw new PipelineRowError(
      'synthetic_opportunity',
      'Synthetic preview data must never be mapped to an employment pipeline row.',
    );
  }

  const companyName = assessment.job.company.trim();
  const roleTitle = assessment.job.title.trim();
  const jobUrl = assessment.job.url.trim();
  if (!companyName || !roleTitle || !jobUrl) {
    throw new PipelineRowError(
      'invalid_row_fields',
      'Company, role title and job URL are required for a pipeline row.',
    );
  }

  return {
    candidate_id: candidateId,
    job_source: assessment.provenance.source,
    company_name: companyName,
    role_title: roleTitle,
    location: assessment.job.location_text.trim() || null,
    job_url: jobUrl,
    fit_scores_5d: assessment.fit_scores_5d as unknown as Json,
    decision_state: assessment.decision.state,
    employer_outcome: 'discovered',
    tailored_resume_pdf_url: null,
    micro_deliverable_url: null,
    skill_passport_url: null,
  };
}
