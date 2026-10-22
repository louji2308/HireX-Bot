/**
 * Supabase configuration discovery for server-only code paths.
 *
 * The application must start (and the health route must answer) even when the
 * backend is not configured yet. Configuration is therefore resolved lazily at
 * request time and missing values are reported as data, never as crashes or
 * fabricated defaults.
 */

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string | null;
}

export interface SupabaseConfigResult {
  readonly config: SupabaseConfig | null;
  readonly missing: readonly string[];
}

function read(environment: NodeJS.ProcessEnv, key: string): string | null {
  const value = environment[key];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function resolveSupabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseConfigResult {
  const url = read(environment, 'NEXT_PUBLIC_SUPABASE_URL') ?? read(environment, 'SUPABASE_URL');
  const anonKey =
    read(environment, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? read(environment, 'SUPABASE_ANON_KEY');
  const serviceRoleKey = read(environment, 'SUPABASE_SERVICE_ROLE_KEY');

  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (url && !/^https?:\/\//.test(url)) missing.push('SUPABASE_URL(form)');

  if (missing.length > 0) return { config: null, missing };

  return { config: { url: url as string, anonKey: anonKey as string, serviceRoleKey }, missing };
}
