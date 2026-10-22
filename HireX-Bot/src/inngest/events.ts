/**
 * Typed Inngest event catalog (Architecture §4, Build Plan Step 3.4).
 *
 * The eight catalog events are the only trigger events. The two resolution
 * signals are wait-only events used by the six-state guard; they are kept
 * separate so the catalog count stays exactly eight.
 */

import { eventType } from 'inngest';
import { z } from 'zod';

import type {
  ApprenticeshipPrMergedPayload,
  ApplicationApprovalRequestedPayload,
  ApplicationApprovalResolvedPayload,
  ApplicationStateRoutedPayload,
  CandidateOnboardingCompletedPayload,
  HireXBotEventName,
  HireXBotEventPayloads,
  HireXBotResolutionPayloads,
  HireXResolutionEventName,
  InterviewInviteDetectedPayload,
  JobDiscoveredBatchPayload,
  RepoPushVerifiedPayload,
  SessionCompletedImmutablePayload,
  UserInputSuppliedPayload,
} from '@/types/phase3_contracts';

const isoString = z.string().datetime({ offset: true });
const uuid = z.string().uuid();

export const candidateOnboardingCompletedSchema = z.object({
  candidate_id: uuid,
  college_tier: z.enum(['Tier_1', 'Tier_2', 'Tier_3', 'Rural']),
  target_roles: z.array(z.string().min(1)).min(1),
  preferred_language: z.enum(['ta', 'hi', 'te', 'kn', 'bn', 'mr', 'en']),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
}) satisfies z.ZodType<CandidateOnboardingCompletedPayload>;

export const jobDiscoveredBatchSchema = z.object({
  candidate_id: uuid,
  jobs: z
    .array(
      z.object({
        job_url: z.string().url(),
        company: z.string().min(1),
        title: z.string().min(1),
        raw_md_url: z.string().url(),
        source: z.string().min(1),
      }),
    )
    .min(1),
}) satisfies z.ZodType<JobDiscoveredBatchPayload>;

export const applicationStateRoutedSchema = z.object({
  candidate_id: uuid,
  event_id: z.string().min(1),
  decision_state: z.enum(['State_1', 'State_2', 'State_3', 'State_4']),
  missing_preferred_skills: z.array(z.string()),
  missing_core_skills: z.array(z.string()),
}) satisfies z.ZodType<ApplicationStateRoutedPayload>;

export const applicationApprovalRequestedSchema = z.object({
  candidate_id: uuid,
  event_id: z.string().min(1),
  tailored_pdf_url: z.string().url(),
  micro_deliverable_url: z.string().url(),
  passport_url: z.string().url(),
}) satisfies z.ZodType<ApplicationApprovalRequestedPayload>;

export const interviewInviteDetectedSchema = z.object({
  candidate_id: uuid,
  company_name: z.string().min(1),
  job_role: z.string().min(1),
  confirmed_round_type: z.string().min(1),
  deadline_iso: isoString,
  invite_text: z.string().min(1),
}) satisfies z.ZodType<InterviewInviteDetectedPayload>;

export const repoPushVerifiedSchema = z.object({
  candidate_id: uuid,
  artifact_id: uuid,
  repo_url: z.string().url(),
  commit_sha: z.string().min(7),
  sprint_ticket_ids: z.array(z.string()),
}) satisfies z.ZodType<RepoPushVerifiedPayload>;

export const apprenticeshipPrMergedSchema = z.object({
  candidate_id: uuid,
  sprint_id: uuid,
  repo_name: z.string().min(1),
  pr_url: z.string().url(),
  merged_at_iso: isoString,
}) satisfies z.ZodType<ApprenticeshipPrMergedPayload>;

export const sessionCompletedImmutableSchema = z.object({
  candidate_id: uuid,
  session_id: uuid,
  round_type: z.string().min(1),
  calibration_mode: z.string().min(1),
  weighted_score: z.number().min(0).max(100),
  baseline_delta: z.number(),
}) satisfies z.ZodType<SessionCompletedImmutablePayload>;

export const HIREX_BOT_EVENT_SCHEMAS = {
  'candidate/onboarding.completed': candidateOnboardingCompletedSchema,
  'job/discovered.batch': jobDiscoveredBatchSchema,
  'application/state.routed': applicationStateRoutedSchema,
  'application/approval.requested': applicationApprovalRequestedSchema,
  'interview/invite.detected': interviewInviteDetectedSchema,
  'repo/push.verified': repoPushVerifiedSchema,
  'apprenticeship/pr.merged': apprenticeshipPrMergedSchema,
  'session/completed.immutable': sessionCompletedImmutableSchema,
} as const satisfies { [K in HireXBotEventName]: z.ZodType<HireXBotEventPayloads[K]> };

export const applicationApprovalResolvedSchema = z.object({
  taskId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  eventId: z.string().min(1),
  resolvedAt: isoString,
}) satisfies z.ZodType<ApplicationApprovalResolvedPayload>;

export const userInputSuppliedSchema = z.object({
  taskId: z.string().min(1),
  inputRequestId: z.string().min(1),
  suppliedAt: isoString,
}) satisfies z.ZodType<UserInputSuppliedPayload>;

export const HIREX_RESOLUTION_EVENT_SCHEMAS = {
  'application/approval.resolved': applicationApprovalResolvedSchema,
  'user.input.supplied': userInputSuppliedSchema,
} as const satisfies { [K in HireXResolutionEventName]: z.ZodType<HireXBotResolutionPayloads[K]> };

export const HIREX_BOT_EVENTS = {
  'candidate/onboarding.completed': eventType('candidate/onboarding.completed', {
    schema: candidateOnboardingCompletedSchema,
  }),
  'job/discovered.batch': eventType('job/discovered.batch', {
    schema: jobDiscoveredBatchSchema,
  }),
  'application/state.routed': eventType('application/state.routed', {
    schema: applicationStateRoutedSchema,
  }),
  'application/approval.requested': eventType('application/approval.requested', {
    schema: applicationApprovalRequestedSchema,
  }),
  'interview/invite.detected': eventType('interview/invite.detected', {
    schema: interviewInviteDetectedSchema,
  }),
  'repo/push.verified': eventType('repo/push.verified', {
    schema: repoPushVerifiedSchema,
  }),
  'apprenticeship/pr.merged': eventType('apprenticeship/pr.merged', {
    schema: apprenticeshipPrMergedSchema,
  }),
  'session/completed.immutable': eventType('session/completed.immutable', {
    schema: sessionCompletedImmutableSchema,
  }),
} as const;

export const HIREX_RESOLUTION_EVENTS = {
  'application/approval.resolved': eventType('application/approval.resolved', {
    schema: applicationApprovalResolvedSchema,
  }),
  'user.input.supplied': eventType('user.input.supplied', {
    schema: userInputSuppliedSchema,
  }),
} as const;
