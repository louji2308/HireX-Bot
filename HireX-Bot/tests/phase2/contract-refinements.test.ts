import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASHA,
  ASHA_RESPONSE_1,
  ASHA_SESSION_1,
  DATABASE_REQUIRED,
  MEERA,
  SHARED_CODING_BLUEPRINT,
  databaseAvailable,
  expectRejection,
  queryAs,
  resetDatabase,
  tpoClaims,
  withAdmin,
} from './helpers/pg';

const available = await databaseAvailable();
if (!available && DATABASE_REQUIRED) {
  throw new Error(
    'HIREX_DB_REQUIRED=1 but PostgreSQL is unreachable. Run scripts/pg-up.ps1 first.',
  );
}
if (!available) {
  console.warn('[phase2] PostgreSQL unavailable - skipping contract refinement suite.');
}
const suite = available ? describe : describe.skip;

async function expectAdminRejection(
  sql: string,
  params: unknown[] = [],
): Promise<{ code?: string; message: string }> {
  try {
    await withAdmin((client) => client.query(sql, params));
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    return { code: pgError.code, message: pgError.message ?? String(error) };
  }
  throw new Error('Expected the statement to be rejected, but it succeeded.');
}

suite('phase 2 - contract refinements (0004)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('uses the exact five-tier confidence vocabulary with em dashes', async () => {
    const inserted = await withAdmin((client) =>
      client.query(
        `INSERT INTO public.interview_blueprints (
            id, company_name, job_role, candidate_level, round_type,
            evaluation_criteria_weights, question_distribution, duration_minutes,
            confidence_tier
         ) VALUES (
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Emdash Ltd', 'Backend Engineer',
            'New_Grad_Fresher', 'Coding', '{}'::jsonb, '{}'::jsonb, 30,
            'Confirmed — Employer Supplied'
         ) RETURNING confidence_tier`,
      ),
    );
    expect(inserted.rows[0].confidence_tier).toBe('Confirmed — Employer Supplied');

    const rejection = await expectAdminRejection(
      `INSERT INTO public.interview_blueprints (
          id, company_name, job_role, candidate_level, round_type,
          evaluation_criteria_weights, question_distribution, duration_minutes,
          confidence_tier
       ) VALUES (
          gen_random_uuid(), 'Ascii Ltd', 'Backend Engineer', 'New_Grad_Fresher', 'Coding',
          '{}'::jsonb, '{}'::jsonb, 30, 'Confirmed - Employer Supplied'
       )`,
    );
    expect(rejection.code).toBe('23514');
  });

  it('rejects any mutation of a published blueprint version', async () => {
    const update = await expectAdminRejection(
      `UPDATE public.interview_blueprints SET duration_minutes = 99 WHERE id = $1`,
      [SHARED_CODING_BLUEPRINT],
    );
    expect(update.message).toContain('versioned and immutable');

    const deletion = await expectAdminRejection(
      `DELETE FROM public.interview_blueprints WHERE id = $1`,
      [SHARED_CODING_BLUEPRINT],
    );
    expect(deletion.message).toContain('versioned and immutable');
  });

  it('snapshots the blueprint version and replay URL on a recorded session', async () => {
    const created = await queryAs<{ id: string }>(
      { role: 'service_role' },
      `SELECT public.record_practice_session(
         $1::uuid, $2::uuid, 9, 'Acme Corp', 'Backend Engineer', 'Coding',
         'Mode_B', '{"difficulty":0.4}'::jsonb, 'rubric-v1', 55.0, 0.0,
         $3::jsonb, 'https://replay.example.test/session-9.jsonl'
       ) AS id`,
      [
        ASHA,
        SHARED_CODING_BLUEPRINT,
        JSON.stringify([
          {
            question_index: 0,
            topic_tags: ['arrays'],
            question_prompt: 'Two sum',
            candidate_code_or_text: 'def two_sum(): ...',
            duration_seconds: 300,
            criterion_scores: { problem_solving: 3 },
            evidence_feedback_md: 'ok',
          },
        ]),
      ],
    );

    const rows = await withAdmin((client) =>
      client.query(
        `SELECT blueprint_version, replay_jsonl_url AS replay
         FROM public.practice_sessions WHERE id = $1`,
        [created[0].id],
      ),
    );

    expect(rows.rows[0].blueprint_version).toBe('v1.0');
    expect(rows.rows[0].replay).toBe('https://replay.example.test/session-9.jsonl');
  });

  it('rejects a session whose company, role or round differs from its blueprint', async () => {
    const rejection = await expectRejection(
      { role: 'service_role' },
      `SELECT public.record_practice_session(
         $1::uuid, $2::uuid, 10, 'Other Corp', 'Backend Engineer', 'Coding',
         'Mode_B', '{}'::jsonb, 'rubric-v1', 50.0, 0.0, $3::jsonb
       )`,
      [
        ASHA,
        SHARED_CODING_BLUEPRINT,
        JSON.stringify([
          {
            question_index: 0,
            topic_tags: ['arrays'],
            question_prompt: 'q',
            candidate_code_or_text: 'a',
            duration_seconds: 1,
            criterion_scores: {},
            evidence_feedback_md: 'e',
          },
        ]),
      ],
    );
    expect(rejection.message).toContain('must match the referenced blueprint');
  });

  it('rejects skill history that does not belong to the candidate and session', async () => {
    const rejection = await expectAdminRejection(
      `INSERT INTO public.candidate_skill_history (
          candidate_id, session_id, response_id, topic_or_criterion, round_type,
          score_five_scale, normalized_score, is_first_attempt_unassisted,
          next_recommended_action
       ) VALUES ($1, $2, $3, 'arrays', 'Coding', 3, 60, TRUE, 'retry')`,
      [MEERA, ASHA_SESSION_1, ASHA_RESPONSE_1],
    );
    expect(rejection.message).toContain('does not own the referenced session');
  });

  it('links skill history to the exact response that produced it', async () => {
    const rows = await withAdmin((client) =>
      client.query(
        `INSERT INTO public.candidate_skill_history (
            candidate_id, session_id, response_id, topic_or_criterion, round_type,
            score_five_scale, normalized_score, is_first_attempt_unassisted,
            next_recommended_action
         ) VALUES ($1, $2, $3, 'arrays', 'Coding', 3, 60, TRUE, 'retry')
         RETURNING response_id`,
        [ASHA, ASHA_SESSION_1, ASHA_RESPONSE_1],
      ),
    );
    expect(rows.rows[0].response_id).toBe(ASHA_RESPONSE_1);
  });

  it('never regresses a pipeline outcome or decision state', async () => {
    const first = await queryAs<{ event_id: string }>(
      { role: 'service_role' },
      `SELECT public.upsert_pipeline_event(
         $1::uuid, 'greenhouse', 'Regression Corp', 'Backend Engineer', 'Testville',
         'https://example.test/regression', '{"skill_match":70}'::jsonb, 'State_3', 'applied'
       ) AS event_id`,
      [ASHA],
    );
    expect(first).toHaveLength(1);

    await queryAs(
      { role: 'service_role' },
      `SELECT public.upsert_pipeline_event(
         $1::uuid, 'naukri', 'Regression Corp', 'Backend Engineer', 'Testville',
         'https://example.test/regression-2', '{"skill_match":10}'::jsonb, 'State_1', 'discovered'
       )`,
      [ASHA],
    );

    const kept = await withAdmin((client) =>
      client.query(
        `SELECT decision_state, employer_outcome, job_source
         FROM public.employment_pipeline_events
         WHERE candidate_id = $1 AND company_name = 'Regression Corp'`,
        [ASHA],
      ),
    );
    expect(kept.rows[0]).toMatchObject({
      decision_state: 'State_3',
      employer_outcome: 'applied',
      job_source: 'naukri',
    });

    await queryAs(
      { role: 'service_role' },
      `SELECT public.upsert_pipeline_event(
         $1::uuid, 'naukri', 'Regression Corp', 'Backend Engineer', 'Testville',
         'https://example.test/regression-3', '{"skill_match":90}'::jsonb, 'State_4', 'offer'
       )`,
      [ASHA],
    );

    const advanced = await withAdmin((client) =>
      client.query(
        `SELECT decision_state, employer_outcome FROM public.employment_pipeline_events
         WHERE candidate_id = $1 AND company_name = 'Regression Corp'`,
        [ASHA],
      ),
    );
    expect(advanced.rows[0]).toMatchObject({ decision_state: 'State_4', employer_outcome: 'offer' });
  });

  it('merges onboarding signals and consent scopes instead of overwriting them', async () => {
    await queryAs(
      { role: 'service_role' },
      `SELECT public.upsert_candidate_profile(
         $1::uuid, 'Asha Kannan', 'asha@example.test', NULL, NULL, NULL, NULL, NULL,
         '{"weekly_hours":20}'::jsonb,
         '{"scopes":{"github_repository_audit":{"status":"granted"}}}'::jsonb
       )`,
      [ASHA],
    );

    const row = await withAdmin((client) =>
      client.query(
        `SELECT onboarding_signals, dpdp_consent_ledger FROM public.candidate_profiles WHERE id = $1`,
        [ASHA],
      ),
    );
    expect(row.rows[0].onboarding_signals).toMatchObject({ weekly_hours: 20, primary_skills: ['python', 'sql'] });
    expect(row.rows[0].dpdp_consent_ledger.scopes.public_passport_hosting.status).toBe('granted');
    expect(row.rows[0].dpdp_consent_ledger.scopes.github_repository_audit.status).toBe('granted');
  });

  it('provides a write path for every previously unwritable table', async () => {
    const portfolio = await queryAs<{ id: string }>(
      { role: 'service_role' },
      `SELECT public.append_portfolio_artifact(
         $1::uuid, 'https://example.test/repo', 55, '{"originality":55}'::jsonb
       ) AS id`,
      [ASHA],
    );
    expect(portfolio[0].id).toMatch(/^[0-9a-f-]{36}$/);

    const sprint = await queryAs<{ id: string }>(
      { role: 'service_role' },
      `SELECT public.upsert_apprenticeship_sprint(
         'b9999999-9999-4999-8999-999999999999'::uuid, $1::uuid, 'Tier_A_CFI',
         'https://example.test/issues/1', 'example/repo', 6
       ) AS id`,
      [ASHA],
    );
    expect(sprint[0].id).toBe('b9999999-9999-4999-8999-999999999999');

    const blueprint = await queryAs<{ id: string }>(
      { role: 'service_role' },
      `SELECT public.insert_blueprint_version(
         'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'Writer Corp', 'SDE',
         'Intern', 'Coding', 'v1.0', '{}'::jsonb, '{}'::jsonb, 30,
         'Company-Informed Simulation'
       ) AS id`,
    );
    expect(blueprint[0].id).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

    const skill = await queryAs<{ id: string }>(
      { role: 'service_role' },
      `SELECT public.append_skill_history(
         'f9999999-9999-4999-8999-999999999999'::uuid, $1::uuid, $2::uuid, $3::uuid,
         'arrays', 'Coding', 3.5, 70, TRUE, 0.6, FALSE, 'continue'
       ) AS id`,
      [ASHA, ASHA_SESSION_1, ASHA_RESPONSE_1],
    );
    expect(skill[0].id).toBe('f9999999-9999-4999-8999-999999999999');
  });

  it('grants writer RPCs to service_role only', async () => {    const rejection = await expectRejection(
      { role: 'authenticated', claims: { sub: ASHA, role: 'authenticated' } },
      `SELECT public.append_portfolio_artifact($1::uuid, 'https://example.test/x', 10, '{}'::jsonb)`,
      [ASHA],
    );
    expect(rejection.code).toBe('42501');
  });

  it('hides the ciphertext vault from authenticated column reads', async () => {
    const rejection = await expectRejection(
      { role: 'authenticated', claims: { sub: ASHA, role: 'authenticated' } },
      `SELECT oauth_token_vault FROM public.candidate_profiles WHERE id = $1`,
      [ASHA],
    );
    expect(rejection.code).toBe('42501');

    const rows = await queryAs<{ id: string }>(
      { role: 'authenticated', claims: { sub: ASHA, role: 'authenticated' } },
      `SELECT id FROM public.candidate_profiles WHERE id = $1`,
      [ASHA],
    );
    expect(rows).toHaveLength(1);
  });

  it('exposes the consented cohort with a real improvement curve', async () => {
    const rows = await queryAs<{
      full_name: string;
      session_count: number;
      baseline_score: number;
      latest_score: number;
      merged_prs: number;
    }>(
      { role: 'authenticated', claims: tpoClaims('Government College of Engineering, Salem') },
      `SELECT full_name, session_count, baseline_score, latest_score, merged_prs
       FROM public.tpo_cohort()`,
    );

    const arjun = rows.find((row) => row.full_name === 'Arjun Krishnamurthy');
    expect(arjun).toMatchObject({
      session_count: 4,
      baseline_score: 58,
      latest_score: 76,
      merged_prs: 1,
    });
    expect(rows.map((row) => row.full_name).sort()).toEqual([
      'Arjun Krishnamurthy',
      'Asha Kannan',
      'Meera Selvam',
    ]);
    expect(rows.some((row) => row.full_name === 'Ravi Prakash')).toBe(false);
  });

  it('denies the cohort to a non-TPO caller', async () => {
    const rows = await queryAs(
      { role: 'authenticated', claims: { sub: ASHA, role: 'authenticated' } },
      `SELECT * FROM public.tpo_cohort()`,
    );
    expect(rows).toHaveLength(0);
  });

  it('erases candidate-owned blueprints but keeps shared ones', async () => {
    await queryAs({ role: 'service_role' }, 'SELECT public.erase_candidate($1)', [ASHA]);

    const owned = await withAdmin((client) =>
      client.query(
        `SELECT count(*)::int AS count FROM public.interview_blueprints WHERE candidate_id = $1`,
        [ASHA],
      ),
    );
    const shared = await withAdmin((client) =>
      client.query(
        `SELECT count(*)::int AS count FROM public.interview_blueprints WHERE candidate_id IS NULL`,
      ),
    );

    expect(owned.rows[0].count).toBe(0);
    expect(shared.rows[0].count).toBeGreaterThanOrEqual(2);
  });
});
