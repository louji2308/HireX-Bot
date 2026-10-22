import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASHA,
  DATABASE_REQUIRED,
  MEERA,
  RAVI,
  candidateClaims,
  databaseAvailable,
  expectRejection,
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
  console.warn('[phase2] PostgreSQL unavailable — skipping DPDP cascade suite.');
}
const suite = available ? describe : describe.skip;

suite('phase 2 — DPDP erasure cascade (FR-103)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('erases every candidate-owned row and preserves unrelated candidates and shared blueprints', async () => {
    const outcome = await withAdmin(async (client) => {
      const erased = await client.query('SELECT public.erase_candidate($1::uuid) AS result', [ASHA]);
      const residual = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.candidate_profiles WHERE id = $1) AS profiles,
           (SELECT count(*)::int FROM public.practice_sessions WHERE candidate_id = $1) AS sessions,
           (SELECT count(*)::int FROM public.session_responses r
              JOIN public.practice_sessions s ON s.id = r.session_id
              WHERE s.candidate_id = $1) AS responses,
           (SELECT count(*)::int FROM public.candidate_skill_history WHERE candidate_id = $1) AS skills,
           (SELECT count(*)::int FROM public.portfolio_artifacts WHERE candidate_id = $1) AS portfolio,
           (SELECT count(*)::int FROM public.apprenticeship_sprints WHERE candidate_id = $1) AS sprints,
           (SELECT count(*)::int FROM public.employment_pipeline_events WHERE candidate_id = $1) AS pipeline,
           (SELECT count(*)::int FROM public.interview_blueprints WHERE candidate_id = $1) AS private_blueprints,
           (SELECT count(*)::int FROM public.interview_blueprints WHERE candidate_id IS NULL) AS shared_blueprints`,
        [ASHA],
      );
      const survivor = await client.query(
        'SELECT count(*)::int AS sessions FROM public.practice_sessions WHERE candidate_id = $1',
        [RAVI],
      );
      const second = await client.query('SELECT public.erase_candidate($1::uuid) AS result', [ASHA]);
      return {
        erased: erased.rows[0].result,
        residual: residual.rows[0],
        survivor: survivor.rows[0].sessions,
        second: second.rows[0].result,
      };
    });

    expect(outcome.erased.erased).toBe(true);
    expect(outcome.erased.counts).toMatchObject({
      candidate_profiles: 1,
      practice_sessions: 4,
      session_responses: 4,
      candidate_skill_history: 3,
      portfolio_artifacts: 1,
      apprenticeship_sprints: 1,
      employment_pipeline_events: 1,
      interview_blueprints: 1,
    });
    expect(outcome.residual).toEqual({
      profiles: 0,
      sessions: 0,
      responses: 0,
      skills: 0,
      portfolio: 0,
      sprints: 0,
      pipeline: 0,
      private_blueprints: 0,
      shared_blueprints: 2,
    });
    expect(outcome.survivor).toBe(1);
    expect(outcome.second.erased).toBe(false);
  });

  it('cascades from an authorized profile deletion without orphaned evidence', async () => {
    const residual = await withAdmin(async (client) => {
      await client.query("SELECT set_config('hirex.erasure', 'on', true)");
      await client.query('DELETE FROM public.candidate_profiles WHERE id = $1', [RAVI]);
      const result = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.practice_sessions WHERE candidate_id = $1) AS sessions,
           (SELECT count(*)::int FROM public.session_responses WHERE session_id = 'd5555555-5555-4555-8555-555555555555') AS responses,
           (SELECT count(*)::int FROM public.employment_pipeline_events WHERE candidate_id = $1) AS pipeline`,
        [RAVI],
      );
      return result.rows[0];
    });

    expect(residual).toEqual({ sessions: 0, responses: 0, pipeline: 0 });
  });

  it('does not cascade to another candidate when the same shared blueprint is used', async () => {
    const counts = await withAdmin(async (client) => {
      const result = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.session_responses r
              JOIN public.practice_sessions s ON s.id = r.session_id
              WHERE s.candidate_id = $1) AS asha_responses,
           (SELECT count(*)::int FROM public.session_responses WHERE session_id = 'd5555555-5555-4555-8555-555555555555') AS ravi_responses`,
        [ASHA],
      );
      return result.rows[0];
    });

    expect(counts).toEqual({ asha_responses: 4, ravi_responses: 1 });
  });

  it('denies erasure to candidates and to anonymous callers', async () => {
    const candidate = await expectRejection(
      { role: 'authenticated', claims: candidateClaims(MEERA) },
      'SELECT public.erase_candidate($1::uuid)',
      [ASHA],
    );
    expect(candidate.code).toBe('42501');

    const anonymous = await expectRejection(
      { role: 'anon' },
      'SELECT public.erase_candidate($1::uuid)',
      [ASHA],
    );
    expect(anonymous.code).toBe('42501');
  });
});
