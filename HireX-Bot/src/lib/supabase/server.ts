import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, type SupabaseConfig } from '@/lib/supabase/config';
import type { Database } from '@/types/database.types';

/**
 * Server-only Supabase client factories.
 *
 * `createUserClient` forwards the caller's access token so every query runs
 * under that candidate's RLS identity. `createServiceClient` is reserved for
 * SECURITY DEFINER RPCs and auth administration; it must never be imported into
 * client components.
 */

export class SupabaseUnavailableError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Supabase is not configured (missing: ${missing.join(', ') || 'unknown'}).`);
    this.name = 'SupabaseUnavailableError';
    this.missing = missing;
  }
}

export function requireSupabaseConfig(environment: NodeJS.ProcessEnv = process.env): SupabaseConfig {
  const { config, missing } = resolveSupabaseConfig(environment);
  if (!config) throw new SupabaseUnavailableError(missing);
  return config;
}

export function createUserClient(
  accessToken: string,
  config = requireSupabaseConfig(),
): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createServiceClient(
  config = requireSupabaseConfig(),
): SupabaseClient<Database> {
  if (!config.serviceRoleKey) {
    throw new SupabaseUnavailableError(['SUPABASE_SERVICE_ROLE_KEY']);
  }
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
