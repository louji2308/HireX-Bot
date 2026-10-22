import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASHA,
  DATABASE_REQUIRED,
  MEERA,
  RAVI,
  candidateClaims,
  databaseAvailable,
  expectRejection,
  queryAs,
  resetDatabase,
  withAdmin,
  withSession,
} from './helpers/pg';

const available = await databaseAvailable();
if (!available && DATABASE_REQUIRED) {
  throw new Error(
    'HIREX_DB_REQUIRED=1 but PostgreSQL is unreachable. Run scripts/pg-up.ps1 first.',
  );
}
if (!available) {
  console.warn('[phase2] PostgreSQL unavailable — skipping public passport suite.');
}
const suite = available ? describe : describe.skip;

suite('phase 2 — evidence-bearing public passport (M6)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('refuses publication without explicit hosting consent', async () => {
    const rejection = await expectRejection(
      { role: 'authenticated', claims: candidateClaims(RAVI) },
      'SELECT public.publish_passport($1)',
      ['ravi-prakash'],
    );
    expect(rejection.message).toContain('public_passport_hosting consent is not granted');
  });

  it('publishes a read-only, PII-free snapshot and withdraws it on unpublish', async () => {
    const result = await withSession(
      { role: 'authenticated', claims: candidateClaims(ASHA), rollback: true },
      async (client) => {
        const published = await client.query('SELECT public.publish_passport($1) AS snapshot', [
          'asha-kannan',
        ]);
        const snapshot = published.rows[0].snapshot as Record<string, unknown>;

        await client.query('RESET ROLE');
        await client.query('SET LOCAL ROLE anon');
        const anonymous = await client.query('SELECT public.get_public_passport($1) AS snapshot', [
          'asha-kannan',
        ]);

        await client.query('RESET ROLE');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query('SAVEPOINT republish_probe');
        const republish = await client
          .query('SELECT public.publish_passport($1)', ['asha-kannan'])
          .then(() => null)
          .catch((error: { message: string }) => error.message);
        await client.query('ROLLBACK TO SAVEPOINT republish_probe');

        await client.query('SELECT public.unpublish_passport()');
        await client.query('RESET ROLE');
        await client.query('SET LOCAL ROLE anon');
        const afterUnpublish = await client.query(
          'SELECT public.get_public_passport($1) IS NULL AS hidden',
          ['asha-kannan'],
        );

        return {
          snapshot,
          anonymousSnapshot: anonymous.rows[0].snapshot,
          republish,
          hiddenAfterUnpublish: afterUnpublish.rows[0].hidden as boolean,
        };
      },
    );

    expect(result.snapshot.schema_version).toBe(1);
    expect(result.snapshot.passport_slug).toBe('asha-kannan');
    expect(result.snapshot.candidate).toEqual({
      full_name: 'Asha Kannan',
      college_name: 'Government College of Engineering, Salem',
      degree_stream: 'B.E. Computer Science',
      graduation_year: 2026,
    });

    const proofs = result.snapshot.proofs as Array<{ kind: string }>;
    expect(proofs.map((proof) => proof.kind)).toEqual([
      'mode_c_simulation',
      'repository_audit',
      'merged_apprenticeship',
    ]);

    const serialized = JSON.stringify(result.snapshot).toLowerCase();
    expect(serialized).not.toContain('@example.test');
    expect(serialized).not.toContain('dpdp');
    expect(serialized).not.toContain('oauth');
    expect(serialized).not.toContain('consent');

    expect(result.anonymousSnapshot).toEqual(result.snapshot);
    expect(result.republish).toContain('passport already published');
    expect(result.hiddenAfterUnpublish).toBe(true);
  });

  it('rejects a slug that is already taken', async () => {
    const collision = await withSession(
      { role: 'authenticated', claims: candidateClaims(ASHA), rollback: true },
      async (client) => {
        await client.query('SELECT public.publish_passport($1)', ['shared-slug']);
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(candidateClaims(MEERA)),
        ]);
        try {
          await client.query('SELECT public.publish_passport($1)', ['shared-slug']);
          return null;
        } catch (error) {
          return (error as { code?: string }).code ?? null;
        }
      },
    );
    expect(collision).toBe('23505');
  });

  it('stops serving a published snapshot when consent is withdrawn', async () => {
    await withAdmin(async (client) => {
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(candidateClaims(MEERA)),
      ]);
      await client.query('SELECT public.publish_passport($1)', ['meera-selvam']);
    }, 'commit');

    const before = await queryAs<{ name: string }>(
      { role: 'anon' },
      "SELECT public.get_public_passport('meera-selvam')->'candidate'->>'full_name' AS name",
    );
    expect(before[0].name).toBe('Meera Selvam');

    await withAdmin(async (client) => {
      await client.query(
        `UPDATE public.candidate_profiles
         SET dpdp_consent_ledger = jsonb_set(
           dpdp_consent_ledger,
           '{scopes,public_passport_hosting,status}',
           '"withdrawn"'::jsonb
         )
         WHERE id = $1`,
        [MEERA],
      );
    }, 'commit');

    const after = await queryAs<{ hidden: boolean }>(
      { role: 'anon' },
      "SELECT public.get_public_passport('meera-selvam') IS NULL AS hidden",
    );
    expect(after[0].hidden).toBe(true);

    await resetDatabase();
  });
});
