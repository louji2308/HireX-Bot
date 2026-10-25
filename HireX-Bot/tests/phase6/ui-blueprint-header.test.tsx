import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BlueprintHeader } from '@/components/studio/BlueprintHeader';
import type { Blueprint, QCPipelineResult } from '@/types/phase6_contracts';

const blueprint: Blueprint = {
  id: 'blueprint-1',
  candidate_id: null,
  company_name: 'Amazon',
  job_role: 'Software Development Engineer',
  candidate_level: 'New_Grad_Fresher',
  round_type: 'Coding',
  blueprint_version: 'v1.0',
  evaluation_criteria_weights: { correctness: 40, complexity: 25, code_quality: 20, explanation: 15 },
  question_distribution: { dsa: 60, system_design: 20, behavioral: 20 },
  duration_minutes: 45,
  confidence_tier: 'Verified — Official Documentation',
  source_urls: ['https://www.amazon.jobs/en/jobs/123'],
  visibility: 'shared',
  inputs: {
    company: 'Amazon',
    job_role: 'Software Development Engineer',
    candidate_level: 'New_Grad_Fresher',
    selected_round: 'Coding',
    expected_format: 'live_coding',
    candidate_capability: {
      weak_topics: [],
      strong_topics: ['dsa'],
      completed_sessions: 0,
      last_weighted_score: null,
      declared_skills: ['typescript'],
    },
    interview_deadline: null,
  },
  created_at: '2026-10-24T12:00:00.000Z',
};

const qc: QCPipelineResult = {
  bundle_id: 'bundle-1',
  blueprint,
  stages: [],
  stage5: null,
  final_status: 'released',
  regenerated_count: 0,
  cached: true,
  pre_warmed: true,
};

describe('Phase 6 blueprint header', () => {
  it('renders the 72px control bar, seven inputs, provenance, and QC badge', () => {
    const html = renderToStaticMarkup(<BlueprintHeader blueprint={blueprint} qc={qc} mode="A" />);
    expect(html).toContain('h-[72px]');
    expect(html).toContain('Company');
    expect(html).toContain('Role');
    expect(html).toContain('Round');
    expect(html).toContain('Mode');
    expect(html).toContain('Language');
    expect(html).toContain('Evidence');
    expect(html).toContain('QC');
    expect(html).toContain('Verified — Official Documentation');
    expect(html).toContain('7/7 QC Checks Passed');
    expect(html).toContain('https://www.amazon.jobs/en/jobs/123');
  });

  it('does not render a hiring probability or guarantee', () => {
    const html = renderToStaticMarkup(<BlueprintHeader blueprint={blueprint} qc={qc} mode="A" />);
    expect(html).not.toContain('Probability of Passing');
    expect(html).not.toContain('Hiring Guarantee');
    expect(html).not.toContain('Apply now');
  });
});
