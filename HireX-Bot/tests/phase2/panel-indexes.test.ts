import { beforeAll, describe, expect, it } from 'vitest';
import {
  DATABASE_REQUIRED,
  databaseAvailable,
  resetDatabase,
  withAdmin,
} from './helpers/pg';

const available = await databaseAvailable();
if (!available && DATABASE_REQUIRED) {
  throw new Error(
    'HIREX_DB_REQUIRED=1 but PostgreSQL is unreachable. Run scripts/pg-up.ps1 first.',
  );
}
if (!available) {
  console.warn('[phase2] PostgreSQL unavailable — skipping schema/index suite.');
}
const suite = available ? describe : describe.skip;

suite('phase 2 — canonical schema shape, constraints and panel indexes', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('exposes exactly the eight canonical tables', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );
      return result.rows.map((row) => row.tablename);
    });

    expect(rows).toEqual([
      'apprenticeship_sprints',
      'candidate_profiles',
      'candidate_skill_history',
      'employment_pipeline_events',
      'interview_blueprints',
      'portfolio_artifacts',
      'practice_sessions',
      'session_responses',
    ]);
  });

  it('keeps the panel A/B/C/D query indexes', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = ANY($1::text[])
         ORDER BY indexname`,
        [
          [
            'practice_sessions_panel_b_idx',
            'practice_sessions_candidate_created_idx',
            'candidate_skill_history_topic_idx',
            'candidate_skill_history_recorded_idx',
            'employment_pipeline_events_state_idx',
            'employment_pipeline_events_outcome_idx',
            'interview_blueprints_lookup_idx',
            'session_responses_session_question_key',
          ],
        ],
      );
      return result.rows;
    });

    expect(rows.map((row) => row.indexname)).toEqual([
      'candidate_skill_history_recorded_idx',
      'candidate_skill_history_topic_idx',
      'employment_pipeline_events_outcome_idx',
      'employment_pipeline_events_state_idx',
      'interview_blueprints_lookup_idx',
      'practice_sessions_candidate_created_idx',
      'practice_sessions_panel_b_idx',
      'session_responses_session_question_key',
    ]);

    const panelB = rows.find((row) => row.indexname === 'practice_sessions_panel_b_idx');
    expect(panelB?.indexdef).toContain('(candidate_id, round_type, company_name, job_role, session_number)');
    expect(panelB?.indexdef).toContain('INCLUDE (weighted_score, baseline_delta, created_at)');

    const responses = rows.find((row) => row.indexname === 'session_responses_session_question_key');
    expect(responses?.indexdef).toContain('UNIQUE INDEX');
  });

  it('uses NULLS NOT DISTINCT for job and blueprint idempotency keys', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<{ indexname: string; indnullsnotdistinct: boolean }>(
        `SELECT c.conname AS indexname, i.indnullsnotdistinct
         FROM pg_constraint c
         JOIN pg_index i ON i.indexrelid = c.conindid
         WHERE c.conname = ANY($1::text[])
         ORDER BY c.conname`,
        [
          [
            'employment_pipeline_events_job_key',
            'interview_blueprints_version_key',
          ],
        ],
      );
      return result.rows;
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.indnullsnotdistinct).toBe(true);
    }
  });

  it('anchors historical rows to candidate, blueprint and rubric version', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'practice_sessions'
         ORDER BY ordinal_position`,
      );
      return result.rows.map((row) => row.column_name);
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        'candidate_id',
        'blueprint_id',
        'session_number',
        'rubric_version_id',
        'merkle_root_hash',
        'trustmodel_cert_url',
      ]),
    );
  });
});
