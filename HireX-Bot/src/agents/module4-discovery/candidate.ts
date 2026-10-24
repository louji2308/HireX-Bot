import { createHash } from 'node:crypto';

import type {
  ExtractedField,
  IntakeSession,
  SignalValue,
} from '@/types/phase4_contracts';
import type {
  CandidateScoringInput,
  CanonicalLocation,
  CompensationFloor,
  EmploymentType,
  JoiningAvailability,
  WorkMode,
} from '@/types/phase5_contracts';

import { canonicalizeSkills, STACK_SIGNAL_SKILLS, splitSkillText } from './skill-vocabulary';

export class CandidateInputError extends Error {
  readonly code = 'INTAKE_INCOMPLETE';

  constructor(message: string) {
    super(message);
    this.name = 'CandidateInputError';
  }
}

const LOCATIONS = new Set<CanonicalLocation>([
  'bengaluru',
  'hyderabad',
  'pune',
  'chennai',
  'delhi_ncr',
  'mumbai',
  'remote_india',
  'anywhere_india',
  'other',
]);

const WORK_MODES = new Set<WorkMode>(['remote', 'hybrid', 'onsite', 'flexible']);
const EMPLOYMENT_TYPES = new Set<EmploymentType>([
  'full_time',
  'internship',
  'apprenticeship',
  'contract',
]);
const COMPENSATION_FLOORS = new Set<CompensationFloor>([
  'credit_only',
  '10k_20k_month',
  '3_5_lpa',
  '6_10_lpa',
  '10_plus_lpa',
  'not_sure',
]);
const JOINING_VALUES = new Set<JoiningAvailability>([
  'immediately',
  'two_weeks',
  'one_month',
  'three_months',
  'six_plus_months',
]);

function signalValue(session: IntakeSession, id: 1 | 2 | 5 | 6 | 7 | 8 | 9 | 10): SignalValue {
  return session.signals[String(id)]?.value ?? null;
}

function requiredStrings(
  session: IntakeSession,
  id: 1 | 2 | 5 | 7,
  label: string,
): string[] {
  const value = signalValue(session, id);
  if (!Array.isArray(value) || value.length === 0) {
    throw new CandidateInputError(`Intake is incomplete: ${label} is required.`);
  }
  const strings = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (strings.length === 0) {
    throw new CandidateInputError(`Intake is incomplete: ${label} is required.`);
  }
  return strings;
}

function requiredString(
  session: IntakeSession,
  id: 6 | 8 | 9,
  label: string,
): string {
  const value = signalValue(session, id);
  if (typeof value !== 'string' || !value) {
    throw new CandidateInputError(`Intake is incomplete: ${label} is required.`);
  }
  return value;
}

function requiredBoolean(session: IntakeSession, id: 10, label: string): boolean {
  const value = signalValue(session, id);
  if (typeof value !== 'boolean') {
    throw new CandidateInputError(`Intake is incomplete: ${label} is required.`);
  }
  return value;
}

function extractedField(session: IntakeSession, key: ExtractedField['key']): ExtractedField | null {
  return session.extraction?.fields.find((field) => field.key === key) ?? null;
}

function confirmedNumber(session: IntakeSession, key: ExtractedField['key']): number | null {
  const field = extractedField(session, key);
  return field?.status === 'confirmed' && typeof field.value === 'number' ? field.value : null;
}

function confirmedString(session: IntakeSession, key: ExtractedField['key']): string | null {
  const field = extractedField(session, key);
  return field?.status === 'confirmed' && typeof field.value === 'string' && field.value.trim()
    ? field.value.trim()
    : null;
}

function extractedSkills(session: IntakeSession): string[] {
  const field = extractedField(session, 'skills_claimed');
  if (!field || !Array.isArray(field.value)) return [];
  return field.value.filter((value): value is string => typeof value === 'string');
}

export function candidateFromIntake(session: IntakeSession): CandidateScoringInput {
  if (!session.completion) {
    throw new CandidateInputError('Finish the local intake before discovering opportunities.');
  }

  const targetRoles = requiredStrings(session, 1, 'target roles');
  const stack = requiredStrings(session, 2, 'declared stack');

  const locations = requiredStrings(session, 5, 'work locations').filter(
    (value): value is CanonicalLocation => LOCATIONS.has(value as CanonicalLocation),
  );
  if (locations.length === 0) {
    throw new CandidateInputError('Intake is incomplete: at least one known work location is required.');
  }

  const rawWorkMode = requiredString(session, 6, 'work mode');
  if (!WORK_MODES.has(rawWorkMode as WorkMode)) {
    throw new CandidateInputError('Intake has an unsupported work mode.');
  }

  const employmentTypes = requiredStrings(session, 7, 'employment types').filter(
    (value): value is EmploymentType => EMPLOYMENT_TYPES.has(value as EmploymentType),
  );
  if (employmentTypes.length === 0) {
    throw new CandidateInputError('Intake is incomplete: at least one known employment type is required.');
  }

  const rawFloor = requiredString(session, 8, 'compensation floor');
  if (!COMPENSATION_FLOORS.has(rawFloor as CompensationFloor)) {
    throw new CandidateInputError('Intake has an unsupported compensation floor.');
  }

  const rawJoining = requiredString(session, 9, 'joining availability');
  if (!JOINING_VALUES.has(rawJoining as JoiningAvailability)) {
    throw new CandidateInputError('Intake has an unsupported joining availability.');
  }

  const declarationSkills = [
    ...stack.flatMap((value) => STACK_SIGNAL_SKILLS[value] ?? []),
    ...extractedSkills(session).flatMap(splitSkillText),
  ];

  return {
    target_roles: targetRoles,
    declared_skills: canonicalizeSkills(declarationSkills),
    locations,
    work_mode: rawWorkMode as WorkMode,
    employment_types: employmentTypes,
    compensation_floor: rawFloor as CompensationFloor,
    joining: rawJoining as JoiningAvailability,
    relocation: requiredBoolean(session, 10, 'relocation preference'),
    graduation_year: confirmedNumber(session, 'graduation_year'),
    degree: confirmedString(session, 'degree_stream'),
    experience_years: 0,
  };
}

export function sampleCandidate(): CandidateScoringInput {
  return {
    target_roles: ['full_stack', 'backend_sde', 'qa_automation'],
    declared_skills: canonicalizeSkills([
      'javascript',
      'typescript',
      'react',
      'node',
      'sql',
      'python',
      'git',
      'data structures',
      'algorithms',
      'css',
    ]),
    locations: ['bengaluru', 'remote_india'],
    work_mode: 'flexible',
    employment_types: ['full_time', 'internship'],
    compensation_floor: '10k_20k_month',
    joining: 'two_weeks',
    relocation: true,
    graduation_year: 2026,
    degree: null,
    experience_years: 0,
  };
}

export function candidateLabel(sample: boolean): string {
  return sample ? 'Sample candidate' : 'Your local intake profile';
}

export function candidateFingerprint(candidate: CandidateScoringInput): string {
  const canonical = JSON.stringify([
    [...candidate.target_roles].sort(),
    [...candidate.declared_skills].sort(),
    [...candidate.locations].sort(),
    candidate.work_mode,
    [...candidate.employment_types].sort(),
    candidate.compensation_floor,
    candidate.joining,
    candidate.relocation,
    candidate.graduation_year,
    candidate.degree,
    candidate.experience_years,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}
