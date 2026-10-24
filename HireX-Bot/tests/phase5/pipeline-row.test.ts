import { describe, expect, it } from 'vitest';

import {
  PipelineRowError,
  toEmploymentPipelineRow,
} from '@/agents/module4-discovery/pipeline-row';
import type { OpportunityAssessment } from '@/types/phase5_contracts';

import { sampleWorkspace } from './fixtures';

function syntheticAssessment(assessment: OpportunityAssessment): OpportunityAssessment {
  return {
    ...assessment,
    job: {
      ...assessment.job,
      source: 'synthetic_fixture',
      capture_method: 'synthetic',
      synthetic: true,
    },
    provenance: {
      ...assessment.provenance,
      source: 'synthetic_fixture',
      capture_method: 'synthetic',
      synthetic: true,
    },
  };
}

describe('Phase 5 employment pipeline row mapper', () => {
  it('maps an assessed captured role to the frozen Phase 2 insert shape', async () => {
    const workspace = await sampleWorkspace();
    const assessment = workspace.jobs[0]!;
    const row = toEmploymentPipelineRow(assessment, workspace.candidateId);

    expect(row.candidate_id).toBe(workspace.candidateId);
    expect(row.job_source).toBe(assessment.provenance.source);
    expect(row.company_name).toBe(assessment.job.company);
    expect(row.role_title).toBe(assessment.job.title);
    expect(row.location).toBe(assessment.job.location_text);
    expect(row.job_url).toBe(assessment.job.url);
    expect(row.decision_state).toBe(assessment.decision.state);
    expect(row.employer_outcome).toBe('discovered');
    expect(row.tailored_resume_pdf_url).toBeNull();
    expect(row.micro_deliverable_url).toBeNull();
    expect(row.skill_passport_url).toBeNull();
    expect(row.fit_scores_5d).toEqual(assessment.fit_scores_5d);
    expect(row).not.toHaveProperty('candidate_name');
    expect(row).not.toHaveProperty('email');
  });

  it('refuses to map synthetic preview data', async () => {
    const workspace = await sampleWorkspace();
    const assessment = syntheticAssessment(workspace.jobs[0]!);

    expect(() => toEmploymentPipelineRow(assessment, workspace.candidateId)).toThrowError(
      expect.objectContaining({ code: 'synthetic_opportunity' }),
    );
  });

  it('requires a real candidate UUID', async () => {
    const workspace = await sampleWorkspace();

    expect(() => toEmploymentPipelineRow(workspace.jobs[0]!, 'not-a-uuid')).toThrowError(
      PipelineRowError,
    );
  });
});
