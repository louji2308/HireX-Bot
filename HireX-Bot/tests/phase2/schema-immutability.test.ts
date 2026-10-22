import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASHA,
  ASHA_SESSION_1,
  ASHA_SESSION_4,
  DATABASE_REQUIRED,
  SHARED_CODING_BLUEPRINT,
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
  console.warn('[phase2] PostgreSQL unavailable — skipping schema immutability suite.');
}
const suite = available ? describe : describe.skip;

const READONLY_MESSAGE =
  'Historical practice_sessions and session_responses are strictly append-only. Create a new session row for retakes or rubric changes.';

suite('phase 2 — append-only historical scoring (FR-801)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('rejects a score mutation even for the table owner', async () => {
    const rejection = await expectRejection(
      { role: 'service_role' },
      'UPDATE public.practice_sessions SET weighted_score = 99 WHERE id = $1',
      [ASHA_SESSION_1],
    );
    expect(rejection.code).toBe('42501');
  });

  it('rejects a score mutation at the trigger for the migration owner', async () => {
    await expect(
      withAdmin(async (client) => {
        await client.query('UPDATE public.practice_sessions SET weighted_score = 99 WHERE id = $1', [
          ASHA_SESSION_1,
        ]);
      }),
    ).rejects.toThrow(READONLY_MESSAGE);
  });

  it('rejects rewriting stored responses for non-eraser roles', async () => {
    const update = await expectRejection(
      { role: 'authenticated', claims: candidateClaims(ASHA) },
      "UPDATE public.session_responses SET evidence_feedback_md = 'rewritten' WHERE session_id = $1",
      [ASHA_SESSION_1],
    );
    expect(update.code).toBe('42501');

    const removal = await expectRejection(
      { role: 'authenticated', claims: candidateClaims(ASHA) },
      'DELETE FROM public.session_responses WHERE session_id = $1',
      [ASHA_SESSION_1],
    );
    expect(removal.code).toBe('42501');
  });

  it('rejects response rewrites at the trigger for the migration owner', async () => {
    await expect(
      withAdmin(async (client) => {
        await client.query(
          "UPDATE public.session_responses SET evidence_feedback_md = 'rewritten' WHERE session_id = $1",
          [ASHA_SESSION_1],
        );
      }),
    ).rejects.toThrow(READONLY_MESSAGE);
  });

  it('freezes derived skill history as well', async () => {
    const rejection = await expectRejection(
      { role: 'service_role' },
      "UPDATE public.candidate_skill_history SET normalized_score = 100 WHERE candidate_id = $1",
      [ASHA],
    );
    expect(rejection.code).toBe('42501');

    await expect(
      withAdmin(async (client) => {
        await client.query(
          "UPDATE public.candidate_skill_history SET normalized_score = 100 WHERE candidate_id = $1",
          [ASHA],
        );
      }),
    ).rejects.toThrow(READONLY_MESSAGE);
  });

  it('records a retake as a new session with its responses atomically', async () => {
    const result = await withAdmin(async (client) => {
      const inserted = await client.query(
        `SELECT public.record_practice_session(
           $1::uuid, $2::uuid, 4, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
           '{"difficulty":0.7}'::jsonb, 'rubric-v2', 84.5, 16.5,
           $3::jsonb
         ) AS session_id`,
        [
          ASHA,
          SHARED_CODING_BLUEPRINT,
          JSON.stringify([
            {
              question_index: 0,
              topic_tags: ['graphs'],
              question_prompt: 'Detect a cycle in a directed graph.',
              candidate_code_or_text: 'def has_cycle(g): ...',
              language_used: 'python',
              hints_used_count: 0,
              independent_first_attempt: true,
              duration_seconds: 800,
              criterion_scores: { problem_solving: 4.5, code_quality: 4.0, testing: 4.0 },
              evidence_feedback_md: 'Correct Kahn algorithm with explicit complexity analysis.',
            },
          ]),
        ],
      );
      const sessionId = inserted.rows[0].session_id as string;

      const counts = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.practice_sessions WHERE candidate_id = $1) AS sessions,
           (SELECT count(*)::int FROM public.session_responses WHERE session_id = $2) AS responses`,
        [ASHA, sessionId],
      );

      return { sessionId, counts: counts.rows[0] };
    });

    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.counts).toEqual({ sessions: 5, responses: 1 });
  });

  it('rolls back the whole retake when a response is malformed', async () => {
    const rejection = await expectRejection(
      { role: 'service_role', rollback: true },
      `SELECT public.record_practice_session(
         $1::uuid, $2::uuid, 4, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
         '{}'::jsonb, 'rubric-v2', 80, 10,
         '[{"question_index":0,"topic_tags":["graphs"],"question_prompt":"q","candidate_code_or_text":"a","duration_seconds":1,"evidence_feedback_md":"x"}]'::jsonb
       )`,
      [ASHA, SHARED_CODING_BLUEPRINT],
    );
    expect(rejection.message).toContain('criterion_scores');

    const sessions = await queryAs<{ count: number }>(
      { role: 'authenticated', claims: candidateClaims(ASHA) },
      'SELECT count(*)::int AS count FROM public.practice_sessions',
    );
    expect(sessions[0].count).toBe(4);
  });

  it('refuses two responses with the same question index', async () => {
    const rejection = await expectRejection(
      { role: 'service_role', rollback: true },
      `SELECT public.record_practice_session(
         $1::uuid, $2::uuid, 4, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
         '{}'::jsonb, 'rubric-v2', 80, 10,
         '[{"question_index":0,"topic_tags":["a"],"question_prompt":"q","candidate_code_or_text":"a","duration_seconds":1,"criterion_scores":{},"evidence_feedback_md":"x"},
           {"question_index":0,"topic_tags":["b"],"question_prompt":"q","candidate_code_or_text":"a","duration_seconds":1,"criterion_scores":{},"evidence_feedback_md":"x"}]'::jsonb
       )`,
      [ASHA, SHARED_CODING_BLUEPRINT],
    );
    expect(rejection.code).toBe('23505');
  });

  it('mints a certificate once and refuses to overwrite it', async () => {
    const first = await withAdmin(async (client) => {
      await client.query('SELECT public.mint_session_certificate($1::uuid, $2, $3)', [
        ASHA_SESSION_1,
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        'https://trustmodel.example.test/cert/s1',
      ]);
      await client.query('SELECT public.mint_session_certificate($1::uuid, $2, NULL)', [
        ASHA_SESSION_1,
        'sha256:9999999999999999999999999999999999999999999999999999999999999999',
      ]);
      const row = await client.query(
        'SELECT merkle_root_hash, trustmodel_cert_url FROM public.practice_sessions WHERE id = $1',
        [ASHA_SESSION_1],
      );
      return row.rows[0];
    });

    expect(first.merkle_root_hash).toBe(
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(first.trustmodel_cert_url).toBe('https://trustmodel.example.test/cert/s1');

    await expect(
      withAdmin(async (client) => {
        await client.query('UPDATE public.practice_sessions SET merkle_root_hash = $2 WHERE id = $1', [
          ASHA_SESSION_4,
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        ]);
      }),
    ).rejects.toThrow(READONLY_MESSAGE);
  });
});
