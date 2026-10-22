import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client, type QueryResult } from 'pg';

export const ADMIN_URL =
  process.env.HIREX_DB_ADMIN_URL ?? 'postgres://postgres:hirex@127.0.0.1:55432/hirex_test';
export const APP_URL =
  process.env.HIREX_DB_URL ?? 'postgres://hirex_app:hirex@127.0.0.1:55432/hirex_test';

export const DATABASE_REQUIRED = process.env.HIREX_DB_REQUIRED === '1';

export const ASHA = '11111111-1111-4111-8111-111111111111';
export const RAVI = '22222222-2222-4222-8222-222222222222';
export const MEERA = '33333333-3333-4333-8333-333333333333';

export const SHARED_CODING_BLUEPRINT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PRIVATE_BLUEPRINT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const ASHA_SESSION_1 = 'd1111111-1111-4111-8111-111111111111';
export const ASHA_SESSION_4 = 'd4444444-4444-4444-8444-444444444444';
export const ASHA_RESPONSE_1 = 'e1111111-1111-4111-8111-111111111111';

type Role = 'anon' | 'authenticated' | 'service_role';

const REPO_ROOT = process.cwd();
const MIGRATIONS = [
  'supabase/migrations/0001_hirex_bot_schema.sql',
  'supabase/migrations/0002_triggers_and_rls.sql',
  'supabase/migrations/0003_function_privilege_hardening.sql',
  'supabase/migrations/0004_phase2_contract_refinements.sql',
];

export function candidateClaims(sub: string) {
  return { sub, role: 'authenticated', aud: 'authenticated' };
}

export function tpoClaims(institution: string, sub = '99999999-9999-4999-8999-999999999999') {
  return {
    sub,
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: { role: 'tpo', institution },
  };
}

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 1500 });
  await client.connect();
  return client;
}

export async function databaseAvailable(): Promise<boolean> {
  try {
    const client = await connect(ADMIN_URL);
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}

export async function adminQuery(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const client = await connect(ADMIN_URL);
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

export async function resetDatabase(): Promise<void> {
  const parsed = new URL(ADMIN_URL);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
    throw new Error(`Refusing to reset a non-local or non-test database: ${ADMIN_URL}`);
  }
  const client = await connect(ADMIN_URL);
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, hirex_app');
    for (const file of MIGRATIONS) {
      await client.query(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
    }
    await client.query(readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}

export interface SessionOptions {
  role: Role;
  claims?: Record<string, unknown> | null;
  rollback?: boolean;
}

export async function withAdmin<T>(
  run: (client: Client) => Promise<T>,
  mode: 'rollback' | 'commit' = 'rollback',
): Promise<T> {
  const client = await connect(ADMIN_URL);
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query(mode === 'commit' ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function withSession<T>(
  options: SessionOptions,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await connect(APP_URL);
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${options.role}`);
    if (options.claims !== undefined) {
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(options.claims ?? {}),
      ]);
    }
    const result = await run(client);
    if (options.rollback) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function queryAs<T>(
  options: SessionOptions,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withSession(options, async (client) => {
    const result = await client.query(sql, params);
    return result.rows as T[];
  });
}

export async function expectRejection(
  options: SessionOptions,
  sql: string,
  params: unknown[] = [],
): Promise<{ code?: string; message: string }> {
  try {
    await queryAs(options, sql, params);
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    return { code: pgError.code, message: pgError.message ?? String(error) };
  }
  throw new Error('Expected the statement to be rejected, but it succeeded.');
}
