import { z } from 'zod';

import {
  PHASE5_SNAPSHOT_SCHEMA_VERSION,
  type OpportunitySnapshot,
} from '@/types/phase5_contracts';

const isoDateTime = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const compensationSchema = z
  .object({
    kind: z.enum(['unknown', 'monthly_stipend', 'annual_ctc']),
    currency: z.literal('INR'),
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    period: z.enum(['month', 'year']).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === 'unknown' && (value.min !== null || value.max !== null || value.period !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unknown compensation must not carry a range or period.',
      });
    }
    if (value.kind === 'monthly_stipend' && value.period !== 'month') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Monthly stipend compensation must use a monthly period.',
      });
    }
    if (value.kind === 'annual_ctc' && value.period !== 'year') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Annual CTC compensation must use a yearly period.',
      });
    }
    if (value.min !== null && value.max !== null && value.min > value.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compensation minimum cannot exceed maximum.',
      });
    }
  });

const requirementsSchema = z
  .object({
    core_skills: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
    preferred_skills: z.array(z.string().trim().min(1).max(60)).max(20),
    min_experience_years: z.number().int().min(0).max(40).nullable(),
    max_experience_years: z.number().int().min(0).max(40).nullable(),
    degree_required: z.string().trim().min(1).max(120).nullable(),
    graduation_years: z.array(z.number().int().min(2000).max(2040)).max(10).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.min_experience_years !== null &&
      value.max_experience_years !== null &&
      value.min_experience_years > value.max_experience_years
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum experience cannot exceed maximum experience.',
      });
    }
  });

const joiningSchema = z
  .object({
    earliest: dateOnly.nullable(),
    latest: dateOnly.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.earliest && value.latest && value.earliest > value.latest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Joining window earliest date cannot exceed latest date.',
      });
    }
  });

const locationSchema = z.enum([
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

const workModeSchema = z.enum(['remote', 'hybrid', 'onsite', 'flexible']);

export const opportunitySnapshotSchema = z
  .object({
    schema_version: z.literal(PHASE5_SNAPSHOT_SCHEMA_VERSION),
    source: z.enum(['greenhouse_public', 'ashby_public', 'synthetic_fixture']),
    source_job_id: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    url: z.string().url().refine((value) => value.startsWith('https://'), {
      message: 'Snapshot URLs must use https.',
    }),
    locations: z.array(locationSchema).min(1).max(10),
    location_text: z.string().trim().min(1).max(160),
    work_modes: z.array(workModeSchema).min(1).max(4),
    employment_type: z.enum(['full_time', 'internship', 'apprenticeship', 'contract']),
    compensation: compensationSchema,
    joining: joiningSchema,
    requirements: requirementsSchema,
    captured_at: isoDateTime,
    source_updated_at: isoDateTime.nullable(),
    published_at: isoDateTime.nullable(),
    valid_through: isoDateTime.nullable(),
    description_excerpt: z.string().trim().min(1).max(1200),
    quality_excerpt: z.string().trim().min(1).max(6000),
    capture_method: z.enum(['manual_api_capture', 'synthetic']),
    synthetic: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.synthetic && value.capture_method !== 'synthetic') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Synthetic snapshots must use the synthetic capture method.',
      });
    }
    if (!value.synthetic && value.capture_method === 'synthetic') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Captured snapshots must not use the synthetic capture method.',
      });
    }
  });

export function parseOpportunitySnapshot(value: unknown): OpportunitySnapshot {
  return opportunitySnapshotSchema.parse(value) as OpportunitySnapshot;
}
