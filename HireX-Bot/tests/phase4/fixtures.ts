import {
  acknowledgeNotice,
  applyAnswer,
  completeIntake,
  createIntakeSession,
  recordProbe,
  skipSignal,
  updateWorkspaceProfile,
} from '@/lib/onboarding/intake-machine';
import { gradePracticeProbe } from '@/lib/onboarding/probe';
import type { IntakeSession, SignalId } from '@/types/phase4_contracts';

export const CANDIDATE_ID = '00000000-0000-4000-8000-000000000101';
export const T0 = '2026-05-01T00:00:00.000Z';

export type AnswerStep =
  | { readonly signalId: SignalId; readonly value: unknown }
  | { readonly signalId: SignalId; readonly skip: true };

export const HAPPY_ANSWERS: readonly AnswerStep[] = [
  { signalId: 1, value: ['backend_sde'] },
  { signalId: 2, value: ['typescript_javascript'] },
  { signalId: 3, skip: true },
  { signalId: 4, value: 'first_role' },
  { signalId: 5, value: ['bengaluru'] },
  { signalId: 6, value: 'remote' },
  { signalId: 7, value: ['full_time'] },
  { signalId: 8, value: 'not_sure' },
  { signalId: 9, value: 'immediately' },
  { signalId: 10, value: true },
  { signalId: 11, value: 'none' },
  { signalId: 12, skip: true },
  { signalId: 13, value: null },
  { signalId: 14, skip: true },
  { signalId: 15, skip: true },
  { signalId: 16, value: '31_plus' },
  { signalId: 17, value: 'no' },
  { signalId: 18, skip: true },
  { signalId: 19, skip: true },
  { signalId: 20, skip: true },
  { signalId: 21, value: ['none_yet'] },
  { signalId: 24, value: ['dsa'] },
  { signalId: 25, value: ['dsa'] },
  { signalId: 26, skip: true },
  { signalId: 27, value: '5_10' },
  { signalId: 28, value: true },
  { signalId: 29, skip: true },
  { signalId: 30, value: false },
  { signalId: 31, skip: true },
  { signalId: 32, value: 'always_ask' },
  { signalId: 33, value: 'always_ask' },
  { signalId: 34, skip: true },
];

export function sessionAtStart(): IntakeSession {
  return createIntakeSession({ candidateId: CANDIDATE_ID, createdAt: T0 });
}

function unwrap(result: ReturnType<typeof applyAnswer>): IntakeSession {
  if (result.status !== 'applied' || !result.session) {
    throw new Error(`Expected applied mutation, received ${result.status}.`);
  }
  return result.session;
}

export function driveAnswers(
  session: IntakeSession,
  steps: readonly AnswerStep[] = HAPPY_ANSWERS,
): IntakeSession {
  return steps.reduce((current, step, index) => {
    const at = `2026-05-01T00:${String(index).padStart(2, '0')}:00.000Z`;
    if ('skip' in step) {
      return unwrap(skipSignal(current, step.signalId, at, current.revision));
    }
    return unwrap(applyAnswer(current, step.signalId, step.value, at, current.revision));
  }, session);
}

export function withWorkspaceProfile(session: IntakeSession): IntakeSession {
  return unwrap(
    updateWorkspaceProfile(
      session,
      { collegeTier: 'Tier_2', preferredLanguage: 'en', autonomyLevel: 2 },
      '2026-05-01T01:00:00.000Z',
      session.revision,
    ),
  );
}

export function withConsent(session: IntakeSession): IntakeSession {
  return unwrap(acknowledgeNotice(session, '2026-05-01T01:01:00.000Z', session.revision));
}

export function withProbe(session: IntakeSession): IntakeSession {
  const result = gradePracticeProbe({
    language: 'typescript',
    mcqChoice: 'swallow',
    explanation: 'The timeout error is caught but the caller cannot recover from the fallback.',
    completedAt: '2026-05-01T01:02:00.000Z',
  });
  return unwrap(recordProbe(session, result, '2026-05-01T01:02:00.000Z', session.revision));
}

export function readyToComplete(): IntakeSession {
  return withConsent(withWorkspaceProfile(driveAnswers(sessionAtStart())));
}

export function completedSession(): IntakeSession {
  const ready = withProbe(readyToComplete());
  return unwrap(
    completeIntake(ready, '2026-05-01T01:03:00.000Z', ready.revision),
  );
}
