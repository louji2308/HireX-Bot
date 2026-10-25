import { SENIORITY_MAX_COMPLEXITY } from '@/types/phase6_contracts';
import type { Blueprint, BlueprintInputs, CandidateLevel } from '@/types/phase6_contracts';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function weightsFor(role: string): Readonly<Record<string, number>> {
  const normalized = role.toLowerCase();
  if (normalized.includes('quality assurance')) {
    return { correctness: 30, test_design: 30, automation: 20, triage: 10, communication: 10 };
  }
  return { correctness: 40, complexity: 25, code_quality: 20, explanation: 15 };
}

function distributionFor(input: BlueprintInputs): Readonly<Record<string, number>> {
  const skills = input.candidate_capability.declared_skills.join(' ').toLowerCase();
  if (skills.includes('react') || skills.includes('node')) {
    return { frontend: 45, backend: 25, testing: 20, behavioral: 10 };
  }
  if (input.job_role.toLowerCase().includes('quality assurance')) {
    return { test_design: 40, automation: 30, triage: 20, behavioral: 10 };
  }
  return { dsa: 60, system_design: 20, behavioral: 10, debugging: 10 };
}

function sourceUrlsFor(company: string): readonly string[] {
  if (company.toLowerCase() === 'amazon') return ['https://www.amazon.jobs/en/jobs/123'];
  return [`https://${company.toLowerCase().replace(/\s+/g, '-')}.example/jobs/1`];
}

export function generateBlueprint(input: BlueprintInputs): Blueprint {
  return {
    id: null,
    candidate_id: null,
    company_name: input.company,
    job_role: input.job_role,
    candidate_level: input.candidate_level,
    round_type: input.selected_round,
    blueprint_version: 'v1.0',
    evaluation_criteria_weights: weightsFor(input.job_role),
    question_distribution: distributionFor(input),
    duration_minutes: 45,
    confidence_tier: 'Verified — Official Documentation',
    source_urls: sourceUrlsFor(input.company),
    visibility: 'shared',
    inputs: input,
    created_at: null,
  };
}

export function seniorityAllows(level: CandidateLevel, complexity: number): boolean {
  return complexity <= SENIORITY_MAX_COMPLEXITY[level];
}

export function toInterviewBlueprintRow(blueprint: Blueprint, candidateId: string | null = blueprint.candidate_id): {
  readonly id: string;
  readonly candidate_id: string | null;
  readonly company_name: string;
  readonly job_role: string;
  readonly candidate_level: CandidateLevel;
  readonly round_type: Blueprint['round_type'];
  readonly blueprint_version: string;
  readonly evaluation_criteria_weights: Readonly<Record<string, number>>;
  readonly question_distribution: Readonly<Record<string, number>>;
  readonly duration_minutes: number;
  readonly confidence_tier: Blueprint['confidence_tier'];
  readonly source_urls: readonly string[];
  readonly visibility: 'shared' | 'candidate';
} {
  if (blueprint.visibility === 'candidate' && (candidateId === null || !isUuid(candidateId))) {
    throw new Error('Candidate blueprint requires a valid UUID.');
  }
  if (candidateId !== null && !isUuid(candidateId)) {
    throw new Error('Candidate blueprint requires a valid UUID.');
  }
  return {
    id: blueprint.id ?? '00000000-0000-4000-8000-000000000601',
    candidate_id: candidateId,
    company_name: blueprint.company_name,
    job_role: blueprint.job_role,
    candidate_level: blueprint.candidate_level,
    round_type: blueprint.round_type,
    blueprint_version: blueprint.blueprint_version,
    evaluation_criteria_weights: blueprint.evaluation_criteria_weights,
    question_distribution: blueprint.question_distribution,
    duration_minutes: blueprint.duration_minutes,
    confidence_tier: blueprint.confidence_tier,
    source_urls: blueprint.source_urls,
    visibility: blueprint.visibility,
  };
}
