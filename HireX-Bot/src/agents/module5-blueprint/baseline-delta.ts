export interface ComparableSession {
  readonly candidate_id: string;
  readonly company_name: string;
  readonly job_role: string;
  readonly round_type: string;
  readonly weighted_score: number;
  readonly id: string;
}

export interface BaselineDeltaInput {
  readonly comparableKey: {
    readonly candidate_id: string;
    readonly company_name: string;
    readonly job_role: string;
    readonly round_type: string;
  };
  readonly latestScore: number;
  readonly sessions: readonly ComparableSession[];
}

export function calculateBaselineDelta(input: BaselineDeltaInput) {
  const comparable = input.sessions.filter((session) =>
    session.candidate_id === input.comparableKey.candidate_id &&
    session.company_name === input.comparableKey.company_name &&
    session.job_role === input.comparableKey.job_role &&
    session.round_type === input.comparableKey.round_type
  );
  if (comparable.length === 0) {
    return {
      comparable_key: input.comparableKey,
      baseline_score: null,
      latest_score: input.latestScore,
      delta: null,
      baseline_session_id: null,
      comparable: false,
    };
  }
  const baseline = comparable[0]!;
  return {
    comparable_key: input.comparableKey,
    baseline_score: baseline.weighted_score,
    latest_score: input.latestScore,
    delta: input.latestScore - baseline.weighted_score,
    baseline_session_id: baseline.id,
    comparable: true,
  };
}
