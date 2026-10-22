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
  console.warn('[phase2] PostgreSQL unavailable — skipping privilege matrix suite.');
}
const suite = available ? describe : describe.skip;

const RECORD_SIGNATURE =
  'uuid,uuid,int,text,text,text,text,jsonb,text,double precision,double precision,jsonb,text';

suite('phase 2 — least-privilege matrix', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('exposes only the intended function grants', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<Record<string, boolean>>(
        `SELECT
           has_function_privilege('anon','public.get_public_passport(text)','EXECUTE') AS anon_passport,
           has_function_privilege('anon','public.publish_passport(text)','EXECUTE') AS anon_publish,
           has_function_privilege('anon','public.erase_candidate(uuid)','EXECUTE') AS anon_erase,
           has_function_privilege('anon','public.hirex_owns_session(uuid)','EXECUTE') AS anon_owns,
           has_function_privilege('authenticated','public.publish_passport(text)','EXECUTE') AS auth_publish,
           has_function_privilege('authenticated','public.unpublish_passport()','EXECUTE') AS auth_unpublish,
           has_function_privilege('authenticated','public.erase_candidate(uuid)','EXECUTE') AS auth_erase,
           has_function_privilege('authenticated','public.record_practice_session(${RECORD_SIGNATURE})','EXECUTE') AS auth_record,
           has_function_privilege('service_role','public.record_practice_session(${RECORD_SIGNATURE})','EXECUTE') AS service_record,
           has_function_privilege('service_role','public.erase_candidate(uuid)','EXECUTE') AS service_erase,
           has_function_privilege('service_role','public.mint_session_certificate(uuid,text,text)','EXECUTE') AS service_mint`,
      );
      return result.rows[0];
    });

    expect(rows).toEqual({
      anon_passport: true,
      anon_publish: false,
      anon_erase: false,
      anon_owns: false,
      auth_publish: true,
      auth_unpublish: true,
      auth_erase: false,
      auth_record: false,
      service_record: true,
      service_erase: true,
      service_mint: true,
    });
  });

  it('keeps tables read-only for candidate and service roles', async () => {
    const rows = await withAdmin(async (client) => {
      const result = await client.query<Record<string, boolean>>(
        `SELECT
           has_table_privilege('authenticated','public.practice_sessions','SELECT') AS auth_select,
           has_table_privilege('authenticated','public.practice_sessions','INSERT') AS auth_insert,
           has_table_privilege('authenticated','public.practice_sessions','UPDATE') AS auth_update,
           has_table_privilege('authenticated','public.practice_sessions','DELETE') AS auth_delete,
           has_table_privilege('service_role','public.practice_sessions','UPDATE') AS service_update,
           has_table_privilege('anon','public.practice_sessions','SELECT') AS anon_select,
           (SELECT count(*) FROM pg_tables
              WHERE schemaname='public'
                AND has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'SELECT'))::int AS anon_readable`,
      );
      return result.rows[0];
    });

    expect(rows).toEqual({
      auth_select: true,
      auth_insert: false,
      auth_update: false,
      auth_delete: false,
      service_update: false,
      anon_select: false,
      anon_readable: 0,
    });
  });
});
