import type {
  CandidateScoringInput,
  CompensationFloor,
  EligibilityCheck,
  EligibilityResult,
  OpportunitySnapshot,
} from '@/types/phase5_contracts';

const FLOOR_MONTHLY: Readonly<Record<CompensationFloor, number | null>> = {
  credit_only: 0,
  '10k_20k_month': 10_000,
  '3_5_lpa': 350_000 / 12,
  '6_10_lpa': 600_000 / 12,
  '10_plus_lpa': 1_000_000 / 12,
  not_sure: null,
};

const JOINING_DAYS: Readonly<Record<CandidateScoringInput['joining'], number>> = {
  immediately: 0,
  two_weeks: 14,
  one_month: 30,
  three_months: 90,
  six_plus_months: 180,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jobMonthlyRange(snapshot: OpportunitySnapshot): { min: number | null; max: number | null } {
  const { compensation } = snapshot;
  if (compensation.kind === 'unknown') return { min: null, max: null };
  const divisor = compensation.period === 'year' ? 12 : 1;
  return {
    min: compensation.min === null ? null : compensation.min / divisor,
    max: compensation.max === null ? null : compensation.max / divisor,
  };
}

function compensationCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  const floor = FLOOR_MONTHLY[candidate.compensation_floor];
  if (floor === null) {
    return {
      id: 'compensation',
      label: 'Compensation floor',
      status: 'not_applicable',
      hard: false,
      detail: 'Compensation floor was not sure, so no boundary is applied.',
    };
  }
  if (candidate.compensation_floor === 'credit_only') {
    return {
      id: 'compensation',
      label: 'Compensation floor',
      status: 'not_applicable',
      hard: false,
      detail: 'Profile accepts credit-only or unpaid learning work.',
    };
  }

  const range = jobMonthlyRange(snapshot);
  if (range.min === null && range.max === null) {
    return {
      id: 'compensation',
      label: 'Compensation floor',
      status: 'unknown',
      hard: false,
      detail: 'No verified compensation range is stated in the captured listing.',
    };
  }
  if (range.max !== null && range.max < floor) {
    return {
      id: 'compensation',
      label: 'Compensation floor',
      status: 'fail',
      hard: true,
      detail: `The stated maximum is below this profile's monthly floor.`,
    };
  }
  if (range.min !== null && range.min >= floor) {
    return {
      id: 'compensation',
      label: 'Compensation floor',
      status: 'pass',
      hard: true,
      detail: 'The stated range starts at or above this profile\'s floor.',
    };
  }
  return {
    id: 'compensation',
    label: 'Compensation floor',
    status: 'unknown',
    hard: false,
    detail: 'The stated range overlaps this profile\'s floor; the actual offer is not confirmed.',
  };
}

function locationCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  const candidateLocations = new Set(candidate.locations);
  const jobLocations = new Set(snapshot.locations);

  if (candidateLocations.has('anywhere_india') || jobLocations.has('anywhere_india')) {
    return {
      id: 'location',
      label: 'Location',
      status: 'pass',
      hard: true,
      detail: 'The captured location boundary is open across India.',
    };
  }
  if (
    candidateLocations.has('remote_india') &&
    (jobLocations.has('remote_india') || snapshot.work_modes.includes('remote'))
  ) {
    return {
      id: 'location',
      label: 'Location',
      status: 'pass',
      hard: true,
      detail: 'Remote work within India is accepted by both the profile and the listing.',
    };
  }

  const overlap = [...candidateLocations].some((location) => jobLocations.has(location));
  if (overlap) {
    return {
      id: 'location',
      label: 'Location',
      status: 'pass',
      hard: true,
      detail: 'A captured work location is in the profile\'s accepted locations.',
    };
  }
  if (candidateLocations.has('other') || jobLocations.has('other')) {
    return {
      id: 'location',
      label: 'Location',
      status: 'unknown',
      hard: true,
      detail: 'A location is labelled Other, so the boundary cannot be confirmed from the snapshot.',
    };
  }
  if (candidate.relocation) {
    return {
      id: 'location',
      label: 'Location',
      status: 'pass',
      hard: true,
      detail: 'The listing is in a different captured location; the profile accepts relocation.',
    };
  }
  return {
    id: 'location',
    label: 'Location',
    status: 'fail',
    hard: true,
    detail: 'The captured location is outside the profile\'s accepted locations and relocation is off.',
  };
}

function workModeCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  if (candidate.work_mode === 'flexible' || snapshot.work_modes.includes('flexible')) {
    return {
      id: 'work_mode',
      label: 'Work mode',
      status: 'pass',
      hard: true,
      detail: 'The profile or listing accepts a flexible work mode.',
    };
  }
  if (snapshot.work_modes.includes(candidate.work_mode)) {
    return {
      id: 'work_mode',
      label: 'Work mode',
      status: 'pass',
      hard: true,
      detail: `Both the profile and listing accept ${candidate.work_mode} work.`,
    };
  }
  return {
    id: 'work_mode',
    label: 'Work mode',
    status: 'fail',
    hard: true,
    detail: `The listing does not offer the profile's required ${candidate.work_mode} work mode.`,
  };
}

function employmentTypeCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  if (candidate.employment_types.includes(snapshot.employment_type)) {
    return {
      id: 'employment_type',
      label: 'Employment type',
      status: 'pass',
      hard: true,
      detail: `The profile accepts ${snapshot.employment_type.replace('_', ' ')} work.`,
    };
  }
  return {
    id: 'employment_type',
    label: 'Employment type',
    status: 'fail',
    hard: true,
    detail: `The profile does not list ${snapshot.employment_type.replace('_', ' ')} as an accepted type.`,
  };
}

function experienceCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  const minimum = snapshot.requirements.min_experience_years;
  if (minimum === null) {
    return {
      id: 'experience',
      label: 'Experience',
      status: 'pass',
      hard: true,
      detail: 'No minimum experience boundary is stated in the captured listing.',
    };
  }
  if (minimum > candidate.experience_years) {
    return {
      id: 'experience',
      label: 'Experience',
      status: 'fail',
      hard: true,
      detail: `The listing asks for at least ${minimum} years; the local profile has ${candidate.experience_years} verified years.`,
    };
  }
  return {
    id: 'experience',
    label: 'Experience',
    status: 'pass',
    hard: true,
    detail: `The profile's ${candidate.experience_years} verified years meet the captured minimum.`,
  };
}

function degreeCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  const required = snapshot.requirements.degree_required;
  if (!required) {
    return {
      id: 'degree',
      label: 'Degree',
      status: 'pass',
      hard: true,
      detail: 'No degree boundary is stated in the captured listing.',
    };
  }
  if (!candidate.degree) {
    return {
      id: 'degree',
      label: 'Degree',
      status: 'unknown',
      hard: true,
      detail: 'The listing states a degree requirement, but the local profile has no confirmed degree.',
    };
  }
  const requiredText = normalizeText(required);
  const candidateText = normalizeText(candidate.degree);
  if (candidateText.includes(requiredText) || requiredText.includes(candidateText)) {
    return {
      id: 'degree',
      label: 'Degree',
      status: 'pass',
      hard: true,
      detail: 'The confirmed degree matches the captured degree requirement.',
    };
  }
  return {
    id: 'degree',
    label: 'Degree',
    status: 'fail',
    hard: true,
    detail: 'The confirmed degree does not match the captured degree requirement.',
  };
}

function graduationYearCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
): EligibilityCheck {
  const years = snapshot.requirements.graduation_years;
  if (!years || years.length === 0) {
    return {
      id: 'graduation_year',
      label: 'Graduation year',
      status: 'pass',
      hard: true,
      detail: 'No graduation-year boundary is stated in the captured listing.',
    };
  }
  if (candidate.graduation_year === null) {
    return {
      id: 'graduation_year',
      label: 'Graduation year',
      status: 'unknown',
      hard: true,
      detail: 'The listing targets specific graduation years, but the local profile has no confirmed year.',
    };
  }
  if (years.includes(candidate.graduation_year)) {
    return {
      id: 'graduation_year',
      label: 'Graduation year',
      status: 'pass',
      hard: true,
      detail: `The confirmed graduation year (${candidate.graduation_year}) is in the captured target set.`,
    };
  }
  return {
    id: 'graduation_year',
    label: 'Graduation year',
    status: 'fail',
    hard: true,
    detail: `The confirmed graduation year (${candidate.graduation_year}) is outside the captured target set.`,
  };
}

function joiningCheck(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
  now: Date,
): EligibilityCheck {
  const { earliest, latest } = snapshot.joining;
  if (!earliest && !latest) {
    return {
      id: 'joining',
      label: 'Joining window',
      status: 'pass',
      hard: true,
      detail: 'No joining window is stated in the captured listing.',
    };
  }

  const start = new Date(now.getTime() + JOINING_DAYS[candidate.joining] * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  if (latest && startDate > latest) {
    return {
      id: 'joining',
      label: 'Joining window',
      status: 'fail',
      hard: true,
      detail: `The profile can start around ${startDate}, after the captured latest start date ${latest}.`,
    };
  }
  if (earliest && startDate < earliest) {
    return {
      id: 'joining',
      label: 'Joining window',
      status: 'pass',
      hard: true,
      detail: `The profile can start before the captured earliest date ${earliest} and can wait for the window.`,
    };
  }
  return {
    id: 'joining',
    label: 'Joining window',
    status: 'pass',
    hard: true,
    detail: 'The profile\'s availability fits the captured joining window.',
  };
}

export function assessEligibility(
  snapshot: OpportunitySnapshot,
  candidate: CandidateScoringInput,
  now: Date = new Date(),
): EligibilityResult {
  const checks: EligibilityCheck[] = [
    compensationCheck(snapshot, candidate),
    locationCheck(snapshot, candidate),
    workModeCheck(snapshot, candidate),
    employmentTypeCheck(snapshot, candidate),
    experienceCheck(snapshot, candidate),
    degreeCheck(snapshot, candidate),
    graduationYearCheck(snapshot, candidate),
    joiningCheck(snapshot, candidate, now),
  ];

  const hardChecks = checks.filter((check) => check.hard);
  const warnings = checks
    .filter((check) => !check.hard && check.status !== 'pass' && check.status !== 'not_applicable')
    .map((check) => check.detail);

  if (hardChecks.some((check) => check.status === 'fail')) {
    return { status: 'fail', checks, warnings };
  }
  if (hardChecks.some((check) => check.status === 'unknown')) {
    return { status: 'unknown', checks, warnings };
  }
  return { status: 'pass', checks, warnings };
}
