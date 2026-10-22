import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASHA,
  ASHA_SESSION_1,
  DATABASE_REQUIRED,
  MEERA,
  RAVI,
  candidateClaims,
  databaseAvailable,
  expectRejection,
  queryAs,
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
  console.warn('[phase2] PostgreSQL unavailable — skipping RLS isolation suite.');
}
const suite = available ? describe : describe.skip;

interface Visibility {
  profiles: number;
  sessions: number;
  responses: number;
  blueprints: number;
  portfolio: number;
  sprints: number;
  skills: number;
  pipeline: number;
}

async function visibilityFor(candidateId: string): Promise<Visibility> {
  const rows = await queryAs<Visibility>(
    { role: 'authenticated', claims: candidateClaims(candidateId) },
    `SELECT
       (SELECT count(id)::int FROM public.candidate_profiles) AS profiles,
       (SELECT count(*)::int FROM public.practice_sessions) AS sessions,
       (SELECT count(*)::int FROM public.session_responses) AS responses,
       (SELECT count(*)::int FROM public.interview_blueprints) AS blueprints,
       (SELECT count(*)::int FROM public.portfolio_artifacts) AS portfolio,
       (SELECT count(*)::int FROM public.apprenticeship_sprints) AS sprints,
       (SELECT count(*)::int FROM public.candidate_skill_history) AS skills,
       (SELECT count(*)::int FROM public.employment_pipeline_events) AS pipeline`,
  );
  return rows[0];
}

suite('phase 2 — row level security isolation (DPDP Rule 3)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('limits every table to the signed-in candidate', async () => {
    expect(await visibilityFor(ASHA)).toEqual({
      profiles: 1,
      sessions: 4,
      responses: 4,
      blueprints: 3,
      portfolio: 1,
      sprints: 1,
      skills: 3,
      pipeline: 1,
    });

    expect(await visibilityFor(RAVI)).toEqual({
      profiles: 1,
      sessions: 1,
      responses: 1,
      blueprints: 2,
      portfolio: 0,
      sprints: 0,
      skills: 0,
      pipeline: 1,
    });

    expect(await visibilityFor(MEERA)).toEqual({
      profiles: 1,
      sessions: 0,
      responses: 0,
      blueprints: 2,
      portfolio: 0,
      sprints: 0,
      skills: 0,
      pipeline: 0,
    });
  });

  it('never exposes candidate-specific blueprints to another candidate', async () => {
    const rows = await queryAs<{ count: number }>(
      { role: 'authenticated', claims: candidateClaims(RAVI) },
      'SELECT count(*)::int AS count FROM public.interview_blueprints WHERE candidate_id IS NOT NULL',
    );
    expect(rows[0].count).toBe(0);
  });

  it('answers ownership checks per candidate without leaking existence', async () => {
    const own = await queryAs<{ owns: boolean }>(
      { role: 'authenticated', claims: candidateClaims(ASHA) },
      'SELECT public.hirex_owns_session($1::uuid) AS owns',
      [ASHA_SESSION_1],
    );
    const foreign = await queryAs<{ owns: boolean }>(
      { role: 'authenticated', claims: candidateClaims(RAVI) },
      'SELECT public.hirex_owns_session($1::uuid) AS owns',
      [ASHA_SESSION_1],
    );
    expect(own[0].owns).toBe(true);
    expect(foreign[0].owns).toBe(false);
  });

  it('gives anonymous callers no direct table access', async () => {
    for (const table of [
      'candidate_profiles',
      'practice_sessions',
      'session_responses',
      'interview_blueprints',
      'portfolio_artifacts',
      'apprenticeship_sprints',
      'candidate_skill_history',
      'employment_pipeline_events',
    ]) {
      const rejection = await expectRejection({ role: 'anon' }, `SELECT * FROM public.${table} LIMIT 1`);
      expect(rejection.code).toBe('42501');
    }
  });

  it('gives candidates no direct write path', async () => {
    const claims = candidateClaims(ASHA);
    const insert = await expectRejection(
      { role: 'authenticated', claims },
      `INSERT INTO public.practice_sessions (
         candidate_id, blueprint_id, session_number, company_name, job_role, round_type,
         calibration_mode, difficulty_vector, rubric_version_id, weighted_score
       ) VALUES ($1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 9, 'X', 'Y', 'Coding', 'Mode_B', '{}', 'r', 50)`,
      [ASHA],
    );
    expect(insert.code).toBe('42501');

    const update = await expectRejection(
      { role: 'authenticated', claims },
      "UPDATE public.candidate_profiles SET full_name = 'Renamed' WHERE id = $1",
      [ASHA],
    );
    expect(update.code).toBe('42501');

    const remove = await expectRejection(
      { role: 'authenticated', claims },
      'DELETE FROM public.session_responses WHERE session_id = $1',
      [ASHA_SESSION_1],
    );
    expect(remove.code).toBe('42501');
  });

  it('defines only SELECT policies on the eight canonical tables', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<{
        tablename: string;
        policyname: string;
        cmd: string;
        roles: string;
      }>(
        `SELECT tablename, policyname, cmd, roles
         FROM pg_policies
         WHERE schemaname = 'public'
         ORDER BY tablename, policyname`,
      );
      return result.rows;
    });

    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((row) => row.tablename)).size).toBe(8);
    for (const row of rows) {
      expect(row.cmd).toBe('SELECT');
      expect(row.roles).toBe('{authenticated}');
    }
  });
});
