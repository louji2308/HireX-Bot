import { describe, expect, it } from 'vitest';

import {
  HIREX_BOT_EVENT_SCHEMAS,
  HIREX_BOT_EVENTS,
  HIREX_RESOLUTION_EVENT_SCHEMAS,
  HIREX_RESOLUTION_EVENTS,
  applicationApprovalResolvedSchema,
  candidateOnboardingCompletedSchema,
  userInputSuppliedSchema,
} from '@/inngest/events';
import {
  HIREX_BOT_EVENT_NAMES,
  HIREX_RESOLUTION_EVENT_NAMES,
} from '@/types/phase3_contracts';

const CANDIDATE_ID = '00000000-0000-4000-8000-000000000001';
const TASK_ID = '00000000-0000-4000-8000-000000000002';
const NOW = '2026-01-01T00:00:00.000Z';

const samples = {
  'candidate/onboarding.completed': {
    candidate_id: CANDIDATE_ID,
    college_tier: 'Tier_2',
    target_roles: ['Backend Engineer'],
    preferred_language: 'ta',
    autonomy_level: 2,
  },
  'job/discovered.batch': {
    candidate_id: CANDIDATE_ID,
    jobs: [
      {
        job_url: 'https://example.com/jobs/1',
        company: 'Example',
        title: 'Backend Intern',
        raw_md_url: 'https://example.com/jobs/1.md',
        source: 'company-careers',
      },
    ],
  },
  'application/state.routed': {
    candidate_id: CANDIDATE_ID,
    event_id: 'event-1',
    decision_state: 'State_2',
    missing_preferred_skills: ['Go'],
    missing_core_skills: [],
  },
  'application/approval.requested': {
    candidate_id: CANDIDATE_ID,
    event_id: 'event-2',
    tailored_pdf_url: 'https://example.com/resume.pdf',
    micro_deliverable_url: 'https://example.com/deliverable.zip',
    passport_url: 'https://example.com/passport',
  },
  'interview/invite.detected': {
    candidate_id: CANDIDATE_ID,
    company_name: 'Example',
    job_role: 'Backend Intern',
    confirmed_round_type: 'technical',
    deadline_iso: NOW,
    invite_text: 'Please join the technical round.',
  },
  'repo/push.verified': {
    candidate_id: CANDIDATE_ID,
    artifact_id: TASK_ID,
    repo_url: 'https://github.com/example/repo',
    commit_sha: 'abcdef1',
    sprint_ticket_ids: ['ticket-1'],
  },
  'apprenticeship/pr.merged': {
    candidate_id: CANDIDATE_ID,
    sprint_id: TASK_ID,
    repo_name: 'example/repo',
    pr_url: 'https://github.com/example/repo/pull/1',
    merged_at_iso: NOW,
  },
  'session/completed.immutable': {
    candidate_id: CANDIDATE_ID,
    session_id: TASK_ID,
    round_type: 'technical',
    calibration_mode: 'company_calibrated',
    weighted_score: 72,
    baseline_delta: 8,
  },
} as const;

describe('Phase 3 event catalog', () => {
  it('freezes exactly eight trigger events and two separate resolution signals', () => {
    expect(HIREX_BOT_EVENT_NAMES).toHaveLength(8);
    expect(new Set(HIREX_BOT_EVENT_NAMES).size).toBe(8);
    expect(HIREX_RESOLUTION_EVENT_NAMES).toEqual([
      'application/approval.resolved',
      'user.input.supplied',
    ]);
    expect(Object.keys(HIREX_BOT_EVENT_SCHEMAS).sort()).toEqual([...HIREX_BOT_EVENT_NAMES].sort());
    expect(Object.keys(HIREX_RESOLUTION_EVENT_SCHEMAS).sort()).toEqual(
      [...HIREX_RESOLUTION_EVENT_NAMES].sort(),
    );
    expect(HIREX_BOT_EVENT_NAMES.some((name) => (HIREX_RESOLUTION_EVENT_NAMES as readonly string[]).includes(name))).toBe(false);
  });

  it('creates named Inngest event types for every catalog event', () => {
    for (const name of HIREX_BOT_EVENT_NAMES) {
      expect(HIREX_BOT_EVENTS[name].name).toBe(name);
      expect(HIREX_RESOLUTION_EVENTS[name as keyof typeof HIREX_RESOLUTION_EVENTS]).toBeUndefined();
    }
  });

  it('accepts valid payloads for all eight events', () => {
    for (const name of HIREX_BOT_EVENT_NAMES) {
      const parsed = HIREX_BOT_EVENT_SCHEMAS[name].safeParse(samples[name]);
      expect(parsed.success, `${name} should parse`).toBe(true);
    }
  });

  it('rejects missing, malformed and out-of-range payloads', () => {
    expect(candidateOnboardingCompletedSchema.safeParse({ ...samples['candidate/onboarding.completed'], autonomy_level: 5 }).success).toBe(false);
    expect(candidateOnboardingCompletedSchema.safeParse({ ...samples['candidate/onboarding.completed'], target_roles: [] }).success).toBe(false);
    expect(HIREX_BOT_EVENT_SCHEMAS['job/discovered.batch'].safeParse({ candidate_id: CANDIDATE_ID, jobs: [] }).success).toBe(false);
    expect(HIREX_BOT_EVENT_SCHEMAS['session/completed.immutable'].safeParse({ ...samples['session/completed.immutable'], weighted_score: 101 }).success).toBe(false);
  });

  it('validates approval and input resolution payloads', () => {
    expect(
      applicationApprovalResolvedSchema.safeParse({
        taskId: 'task-1',
        decision: 'approved',
        eventId: 'decision-1',
        resolvedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      applicationApprovalResolvedSchema.safeParse({
        taskId: 'task-1',
        decision: 'maybe',
        eventId: 'decision-1',
        resolvedAt: NOW,
      }).success,
    ).toBe(false);
    expect(
      userInputSuppliedSchema.safeParse({
        taskId: 'task-1',
        inputRequestId: 'input-1',
        suppliedAt: NOW,
      }).success,
    ).toBe(true);
  });
});
