import { describe, expect, it } from 'vitest';

import {
  acknowledgeNotice,
  applyAnswer,
  applyExtraction,
  canComplete,
  completeIntake,
  createIntakeSession,
  reviewExtraction,
  skipSignal,
  updateWorkspaceProfile,
} from '@/lib/onboarding/intake-machine';
import { extractResumeText } from '@/lib/onboarding/extraction';
import { buildCompletionPayload } from '@/lib/onboarding/taxonomy';
import {
  completedSession,
  driveAnswers,
  HAPPY_ANSWERS,
  readyToComplete,
  sessionAtStart,
  T0,
  withConsent,
  withWorkspaceProfile,
} from './fixtures';

function unwrap(result: ReturnType<typeof applyAnswer>) {
  if (result.status !== 'applied' || !result.session) {
    throw new Error(`Expected applied, received ${result.status}.`);
  }
  return result.session;
}

describe('Phase 4 intake machine', () => {
  it('creates a local draft with no inferred college tier and a conservative autonomy default', () => {
    const session = createIntakeSession({ candidateId: '00000000-0000-4000-8000-000000000101', createdAt: T0 });
    expect(session.mode).toBe('local_draft');
    expect(session.revision).toBe(0);
    expect(session.profile).toEqual({
      collegeTier: null,
      preferredLanguage: 'en',
      autonomyLevel: 2,
    });
    expect(session.consent.acknowledgedAt).toBeNull();
    expect(session.extraction).toBeNull();
    expect(canComplete(session)).toBe(false);
  });

  it('rejects an unknown signal and an invalid option', () => {
    const session = sessionAtStart();
    expect(applyAnswer(session, 99 as never, 'x', T0, 0).status).toBe('rejected');
    expect(applyAnswer(session, 1, ['not_a_role'], T0, 0)).toMatchObject({
      status: 'rejected',
      code: 'INVALID_VALUE',
    });
  });

  it('returns duplicate for the same answer instead of overwriting history', () => {
    const first = unwrap(applyAnswer(sessionAtStart(), 1, ['backend_sde'], T0, 0));
    const duplicate = applyAnswer(first, 1, ['backend_sde'], T0, first.revision);
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.session).toBe(first);
  });

  it('requires a revision match', () => {
    const session = sessionAtStart();
    expect(applyAnswer(session, 1, ['backend_sde'], T0, 7)).toMatchObject({
      status: 'conflict',
    });
  });

  it('refuses to skip a required signal', () => {
    expect(skipSignal(sessionAtStart(), 1, T0, 0)).toMatchObject({
      status: 'rejected',
      code: 'SIGNAL_REQUIRED',
    });
  });

  it('records permission answers as append-only consent entries', () => {
    const session = driveAnswers(sessionAtStart(), [
      ...HAPPY_ANSWERS.slice(0, 15),
      { signalId: 16, value: 'none' },
      ...HAPPY_ANSWERS.slice(20, 27),
      { signalId: 30, value: true },
    ]);

    const entries = session.consent.entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      signalId: 30,
      granted: true,
      purpose: 'Connect email and read relevant job-search messages',
    });

    const changed = unwrap(
      applyAnswer(session, 30, false, '2026-05-01T02:00:00.000Z', session.revision),
    );
    expect(changed.consent.entries).toHaveLength(2);
    expect(changed.consent.entries[1]).toMatchObject({ signalId: 30, granted: false });
    expect(changed.consent.entries[0]).toEqual(entries[0]);
  });

  it('applies extraction, then requires an explicit review before completion', () => {
    const extraction = extractResumeText({
      text: 'Sample Candidate\nsample@example.com\nB.Tech Computer Science\nhttps://github.com/example',
      sourceName: 'resume.txt',
    });
    const applied = unwrap(applyExtraction(sessionAtStart(), extraction, T0, 0));
    expect(applied.extraction?.status).toBe('ok');
    expect(applied.extractionReviewedAt).toBeNull();

    const reviewed = unwrap(
      reviewExtraction(
        applied,
        {
          fields: { full_name: 'Corrected Name' },
          collegeTier: 'Tier_3',
          preferredLanguage: 'hi',
        },
        T0,
        applied.revision,
      ),
    );
    expect(reviewed.extractionReviewedAt).not.toBeNull();
    expect(reviewed.profile).toMatchObject({
      collegeTier: 'Tier_3',
      preferredLanguage: 'hi',
    });
    const name = reviewed.extraction?.fields.find((field) => field.key === 'full_name');
    expect(name).toMatchObject({ value: 'Corrected Name', status: 'confirmed', source: 'user' });
  });

  it('does not require that every signal be answered before consent is acknowledged', () => {
    const acknowledged = unwrap(acknowledgeNotice(sessionAtStart(), T0, 0));
    expect(acknowledged.consent.acknowledgedAt).toBe(T0);
    expect(canComplete(acknowledged)).toBe(false);
  });

  it('rejects invalid college tiers and autonomy levels', () => {
    const session = sessionAtStart();
    expect(
      updateWorkspaceProfile(session, { collegeTier: 'Tier_9' as never }, T0, 0).status,
    ).toBe('rejected');
    expect(
      updateWorkspaceProfile(session, { autonomyLevel: 5 as never }, T0, 0).status,
    ).toBe('rejected');
  });

  it('completes only once and preserves the validated payload', () => {
    const ready = readyToComplete();
    expect(canComplete(ready)).toBe(true);
    const completed = completedSession();
    expect(completed.completion?.payload).toEqual({
      candidate_id: '00000000-0000-4000-8000-000000000101',
      college_tier: 'Tier_2',
      target_roles: ['Backend SDE'],
      preferred_language: 'en',
      autonomy_level: 2,
    });
    expect(completed.completion?.fanOut).toEqual({
      durable: false,
      source: 'local_preview',
      lanes: ['discovery', 'application_prep', 'training'],
    });

    expect(completeIntake(completed, T0, completed.revision).status).toBe('duplicate');
  });

  it('rejects completion when consent is missing', () => {
    const noConsent = withWorkspaceProfile(driveAnswers(sessionAtStart()));
    const result = completeIntake(noConsent, T0, noConsent.revision);
    expect(result).toMatchObject({ status: 'rejected', code: 'INCOMPLETE' });
    expect(buildCompletionPayload(noConsent).ok).toBe(true);
    expect(buildCompletionPayload(withConsent(noConsent)).ok).toBe(true);
  });
});
