import { describe, expect, it } from 'vitest';

import { loadOpportunitySnapshots } from '@/lib/opportunities/snapshot-source';
import { parseOpportunitySnapshot } from '@/lib/opportunities/snapshot-schema';
import type { OpportunitySnapshot } from '@/types/phase5_contracts';

import { capturedSnapshots } from './fixtures';

function baseSnapshot(): OpportunitySnapshot {
  return {
    schema_version: 'phase5.snapshot.v1',
    source: 'synthetic_fixture',
    source_job_id: 'fixture-1',
    company: 'Fixture Co',
    title: 'Junior Engineer',
    url: 'https://example.test/jobs/1',
    locations: ['bengaluru'],
    location_text: 'Bengaluru',
    work_modes: ['onsite'],
    employment_type: 'full_time',
    compensation: { kind: 'unknown', currency: 'INR', min: null, max: null, period: null },
    joining: { earliest: null, latest: null },
    requirements: {
      core_skills: ['javascript'],
      preferred_skills: [],
      min_experience_years: 0,
      max_experience_years: null,
      degree_required: null,
      graduation_years: null,
    },
    captured_at: '2026-10-24T00:00:00.000Z',
    source_updated_at: null,
    published_at: null,
    valid_through: null,
    description_excerpt: 'A junior engineering role.',
    quality_excerpt: 'No training fee is requested.',
    capture_method: 'synthetic',
    synthetic: true,
  };
}

describe('Phase 5 snapshot schema and captured source', () => {
  it('loads the seven captured snapshots with stable identities', async () => {
    const snapshots = await loadOpportunitySnapshots();
    expect(snapshots).toHaveLength(7);
    expect(new Set(snapshots.map((snapshot) => `${snapshot.source}:${snapshot.source_job_id}`)).size).toBe(7);
    expect(snapshots.every((snapshot) => snapshot.synthetic === false)).toBe(true);
    expect(snapshots.every((snapshot) => snapshot.capture_method === 'manual_api_capture')).toBe(true);
    expect(snapshots.every((snapshot) => snapshot.captured_at === '2026-10-24T00:00:00.000Z')).toBe(true);
  });

  it('rejects a version mismatch and a synthetic/capture-method mismatch', () => {
    expect(() =>
      parseOpportunitySnapshot({ ...baseSnapshot(), schema_version: 'phase5.snapshot.v2' }),
    ).toThrow();
    expect(() =>
      parseOpportunitySnapshot({ ...baseSnapshot(), capture_method: 'manual_api_capture' }),
    ).toThrow();
  });

  it('rejects unknown compensation carrying a range and an empty core-skill set', () => {
    const invalidCompensation = baseSnapshot();
    expect(() =>
      parseOpportunitySnapshot({
        ...invalidCompensation,
        compensation: { ...invalidCompensation.compensation, min: 1000 },
      }),
    ).toThrow();
    expect(() =>
      parseOpportunitySnapshot({
        ...baseSnapshot(),
        requirements: { ...baseSnapshot().requirements, core_skills: [] },
      }),
    ).toThrow();
  });

  it('keeps source URLs https-only', () => {
    expect(() =>
      parseOpportunitySnapshot({ ...baseSnapshot(), url: 'http://example.test/jobs/1' }),
    ).toThrow();
  });

  it('loads every captured record through the same schema', async () => {
    const snapshots = await capturedSnapshots();
    for (const snapshot of snapshots) {
      expect(parseOpportunitySnapshot(snapshot)).toMatchObject({
        schema_version: 'phase5.snapshot.v1',
        source_job_id: snapshot.source_job_id,
      });
    }
  });
});
