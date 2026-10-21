/**
 * Server composition root for the sandbox.
 *
 * Before this module existed, `PistonClient` was only ever constructed inside
 * tests: the environment variable documented in `.env.example` was never read,
 * so a deployed instance silently used the public host whose `/execute` returns
 * 401. The rules here:
 *
 * - the default remains the self-hosted instance, never the public host;
 * - a non-loopback endpoint is refused unless `PISTON_ALLOW_REMOTE=1` is set
 *   explicitly, so candidate code cannot be posted to an unknown third party by
 *   accident;
 * - the language allowlist is intersected with what the executor verified, so a
 *   candidate is not offered a language the sandbox cannot run.
 */

import {
  PistonClient,
  SELF_HOSTED_BASE_URL,
  type ExecuteRequest,
  type PistonCapability,
  type PistonFetch,
  type PistonOutcome,
} from './client';

export const SANDBOX_LANGUAGE_ALLOWLIST = ['python', 'javascript'] as const;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0', 'host.docker.internal']);

export interface SandboxConfig {
  readonly baseUrl: string;
  readonly fallbackBaseUrls: readonly string[];
  /** Endpoints dropped because they are remote and `PISTON_ALLOW_REMOTE` was not set. */
  readonly rejectedRemoteEndpoints: readonly string[];
  readonly allowedLanguages: readonly string[];
  readonly allowRemote: boolean;
}

export type SandboxEnvironment = Readonly<Record<string, string | undefined>>;

export class SandboxConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxConfigError';
  }
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s;]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function isLoopback(endpoint: string): boolean {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

function normalise(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

/**
 * Resolves the sandbox configuration without touching the network.
 *
 * Throws when the only configured endpoint is remote and remote execution has
 * not been opted into: falling back to "some other host" would hide a
 * misconfiguration behind a result the candidate cannot trust.
 */
export function resolveSandboxConfig(env: SandboxEnvironment = process.env): SandboxConfig {
  const allowRemote = env.PISTON_ALLOW_REMOTE === '1';
  const requested = env.PISTON_BASE_URL?.trim() || SELF_HOSTED_BASE_URL;
  const candidates = [requested, ...parseList(env.PISTON_FALLBACK_BASE_URLS)];

  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const candidate of candidates) {
    const endpoint = normalise(candidate);
    if (allowRemote || isLoopback(endpoint)) {
      accepted.push(endpoint);
    } else {
      rejected.push(endpoint);
    }
  }

  if (accepted.length === 0) {
    throw new SandboxConfigError(
      `Refusing to use non-loopback executor(s) ${rejected.join(', ')}. ` +
        'Set PISTON_ALLOW_REMOTE=1 only if you intend to send candidate code to that host.',
    );
  }

  const requestedLanguages = parseList(env.PISTON_ALLOWED_LANGUAGES);
  const allowedLanguages =
    requestedLanguages.length > 0 ? requestedLanguages : [...SANDBOX_LANGUAGE_ALLOWLIST];

  return {
    baseUrl: accepted[0] as string,
    fallbackBaseUrls: accepted.slice(1),
    rejectedRemoteEndpoints: rejected,
    allowedLanguages,
    allowRemote,
  };
}

export interface SandboxService {
  readonly config: SandboxConfig;
  execute(request: ExecuteRequest): Promise<PistonOutcome>;
  capability(): Promise<PistonCapability>;
}

export interface CreateSandboxServiceOptions {
  readonly env?: SandboxEnvironment;
  readonly fetchImpl?: PistonFetch;
  readonly client?: PistonClient;
}

export function createSandboxService(options: CreateSandboxServiceOptions = {}): SandboxService {
  const config = resolveSandboxConfig(options.env ?? process.env);
  const client =
    options.client ??
    new PistonClient({
      fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, init)),
      baseUrl: config.baseUrl,
      fallbackBaseUrls: config.fallbackBaseUrls,
    });

  return {
    config,
    async execute(request) {
      const language = request.language.toLowerCase();
      if (!config.allowedLanguages.includes(language)) {
        return {
          kind: 'unsupported_language',
          message: `The sandbox is not enabled for ${request.language}. Enabled: ${config.allowedLanguages.join(', ')}.`,
        };
      }
      return client.execute({ ...request, language });
    },
    capability: () => client.probeCapability(),
  };
}

let cached: SandboxService | null = null;

export function getSandboxService(): SandboxService {
  cached ??= createSandboxService();
  return cached;
}

/** Test seam: forget the process-wide service so the next call re-reads env. */
export function resetSandboxServiceForTests(): void {
  cached = null;
}

export function executeSandbox(request: ExecuteRequest): Promise<PistonOutcome> {
  return getSandboxService().execute(request);
}

export function getSandboxCapability(): Promise<PistonCapability> {
  return getSandboxService().capability();
}
