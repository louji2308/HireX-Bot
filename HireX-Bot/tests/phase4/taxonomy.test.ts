import { describe, expect, it } from 'vitest';

import {
  allSignalsResolved,
  buildCompletionPayload,
  chapterProgress,
  conditionalSkipReason,
  deriveIntakeDiagnostics,
  nextSignalId,
  signalStatus,
} from '@/lib/onboarding/taxonomy';
import {
  PHASE4_TAXONOMY_VERSION,
  SIGNAL_CHAPTERS,
  SIGNAL_DEFINITIONS,
} from '@/types/phase4_contracts';
import {
  driveAnswers,
  HAPPY_ANSWERS,
  readyToComplete,
  sessionAtStart,
  withWorkspaceProfile,
} from './fixtures';

describe('Phase 4 34-signal taxonomy', () => {
  it('defines exactly 34 unique signals across seven chapters', () => {
    expect(SIGNAL_DEFINITIONS).toHaveLength(34);
    expect(new Set(SIGNAL_DEFINITIONS.map((signal) => signal.id)).size).toBe(34);
    expect(SIGNAL_CHAPTERS).toHaveLength(7);
    expect(
      SIGNAL_CHAPTERS.flatMap((chapter) => chapter.signalIds).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 34 }, (_, index) => index + 1));
    expect(PHASE4_TAXONOMY_VERSION).toBe('34-signal.v1');
  });

  it('moves one signal at a time and never skips a required signal silently', () => {
    const session = sessionAtStart();
    expect(nextSignalId(session)).toBe(1);

    const afterGoal = driveAnswers(session, [{ signalId: 1, value: ['backend_sde'] }]);
    expect(nextSignalId(afterGoal)).toBe(2);
  });

  it('skips 17-20 when the candidate has not started applying', () => {
    const session = driveAnswers(sessionAtStart(), [
      ...HAPPY_ANSWERS.slice(0, 15),
      { signalId: 16, value: 'none' },
    ]);

    expect(conditionalSkipReason(session, 17)).toBe('skipped_conditional');
    expect(conditionalSkipReason(session, 18)).toBe('skipped_conditional');
    expect(conditionalSkipReason(session, 19)).toBe('skipped_conditional');
    expect(conditionalSkipReason(session, 20)).toBe('skipped_conditional');
    expect(nextSignalId(session)).toBe(21);
  });

  it('skips 22-23 when no live interview has been attended', () => {
    const interviewSession = driveAnswers(sessionAtStart(), HAPPY_ANSWERS.slice(0, 21));

    expect(signalStatus(interviewSession, 22)).toBe('skipped_conditional');
    expect(signalStatus(interviewSession, 23)).toBe('skipped_conditional');
    expect(nextSignalId(interviewSession)).toBe(24);
  });

  it('derives the PRD FR-105 bottleneck from signals 16 and 17', () => {
    const bottlenecks = withWorkspaceProfile(driveAnswers(sessionAtStart()));

    expect(deriveIntakeDiagnostics(bottlenecks)).toMatchObject({
      bottleneck: true,
      freeOnly: true,
    });
    expect(deriveIntakeDiagnostics(bottlenecks).reasons).toHaveLength(2);
  });

  it('builds the frozen completion payload only after every signal is resolved', () => {
    const partial = sessionAtStart();
    expect(buildCompletionPayload(partial).ok).toBe(false);

    const ready = readyToComplete();
    expect(allSignalsResolved(ready)).toBe(true);
    const built = buildCompletionPayload(ready);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.payload).toEqual({
      candidate_id: '00000000-0000-4000-8000-000000000101',
      college_tier: 'Tier_2',
      target_roles: ['Backend SDE'],
      preferred_language: 'en',
      autonomy_level: 2,
    });
  });

  it('reports chapter progress without a question-of-34 counter', () => {
    const progress = chapterProgress(sessionAtStart());
    expect(progress.goals).toEqual({ resolved: 0, total: 4 });
    expect(Object.keys(progress)).toHaveLength(7);
  });
});
