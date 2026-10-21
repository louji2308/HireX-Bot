/**
 * Piston sandbox client (ADR-006, Build Plan.md Step 1.5).
 *
 * Honest-state requirement (AGENTS.md ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§12.5): a caller must be able to tell the
 * difference between "the candidate's code failed", "the code was killed for
 * exceeding a limit", "we are not authorised to execute", and "the executor
 * itself is down". Collapsing those into a boolean is the failure mode this
 * type union exists to prevent.
 *
 * Verified 2026-10-21: the public host `POST /api/v2/piston/execute` returns 401
 * without credentials (runtimes stay public). A self-hosted Piston instance on
 * `http://localhost:2000/api/v2` does execute for real: pass stdout, SIGKILL at
 * the wall-clock limit (`status: "TO"`) and a cgroup memory kill at ~the
 * configured limit (code 137) were all observed. `probeCapability` reports the
 * asymmetry instead of pretending execution works.
 */

import { z } from 'zod';

export const PISTON_LIMITS = {
  runTimeoutMs: 3_000,
  runCpuTimeMs: 3_000,
  runMemoryLimitBytes: 134_217_728,
} as const;

export const PISTON_MAX_SOURCE_BYTES = 65_536;

/** Hard ceiling for a single probe HTTP call; a dead WSL socket must not hang a page. */
export const PROBE_TIMEOUT_MS = 5_000;

const PROBE_PROGRAMS: Readonly<Record<string, string>> = {
  python: 'print(1)',
  javascript: 'console.log(1)',
};

export const SELF_HOSTED_BASE_URL = 'http://127.0.0.1:2000/api/v2';
export const PUBLIC_BASE_URL = 'https://emkc.org/api/v2/piston';

/**
 * Self-hosted first: the public host answers /runtimes but returns 401 for
 * /execute, so using it as the default turns every demo run into an auth error.
 */
export const DEFAULT_BASE_URL = SELF_HOSTED_BASE_URL;

export interface PistonFetchInit {
  readonly method: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Omitted for GET. Sending an empty body with GET makes the real Fetch API
   * throw before any socket opens, which turned every health probe into a fake
   * "unreachable" report.
   */
  readonly body?: string;
  readonly signal?: AbortSignal;
}

export interface PistonFetchResponse {
  readonly status: number;
  readonly ok: boolean;
  text(): Promise<string>;
  readonly headers: { get(name: string): string | null };
}

export type PistonFetch = (url: string, init: PistonFetchInit) => Promise<PistonFetchResponse>;

export interface PistonClientOptions {
  readonly fetchImpl: PistonFetch;
  readonly baseUrl?: string;
  /**
   * Ordered secondary executors (for example a self-hosted Piston instance on
   * AgentFoundry). Used only when the primary endpoint looks like
   * infrastructure failure, never to reinterpret a candidate's result.
   */
  readonly fallbackBaseUrls?: readonly string[];
  readonly maxSourceBytes?: number;
  readonly timeoutMs?: number;
}

export interface ExecuteRequest {
  readonly language: string;
  readonly source: string;
  readonly version?: string;
  readonly stdin?: string;
  /** Defaults to PISTON_LIMITS.runMemoryLimitBytes. */
  readonly memoryLimitBytes?: number;
  readonly cpuTimeMs?: number;
  readonly runTimeoutMs?: number;
}

export type PistonOutcome =
  | {
      readonly kind: 'passed';
      readonly stdout: string;
      readonly stderr: string;
      readonly exitCode: number;
      readonly cpuTimeMs: number;
      readonly wallTimeMs: number;
      readonly memoryBytes: number;
      readonly language: string;
      readonly version: string;
    }
  | { readonly kind: 'compile_error'; readonly message: string; readonly language: string; readonly version: string }
  | {
      readonly kind: 'runtime_error';
      readonly message: string;
      readonly exitCode: number | null;
      readonly language: string;
      readonly version: string;
    }
  | { readonly kind: 'time_limit_exceeded'; readonly message: string; readonly language: string; readonly version: string }
  | {
      readonly kind: 'memory_limit_exceeded';
      readonly message: string;
      readonly peakMemoryBytes: number;
      readonly language: string;
      readonly version: string;
    }
  | {
      readonly kind: 'output_limit_exceeded';
      readonly message: string;
      readonly language: string;
      readonly version: string;
    }
  | {
      readonly kind: 'killed';
      readonly message: string;
      readonly signal: string;
      readonly language: string;
      readonly version: string;
    }
  | { readonly kind: 'unsupported_language'; readonly message: string }
  | { readonly kind: 'invalid_request'; readonly message: string }
  | { readonly kind: 'infra_error'; readonly message: string }
  | { readonly kind: 'unauthorized'; readonly message: string; readonly status: number }
  | { readonly kind: 'rate_limited'; readonly message: string; readonly retryAfterMs: number };

export interface PistonCapability {
  readonly runtimesReachable: boolean;
  readonly executionAuthorized: boolean;
  /** Languages whose probe program actually ran successfully on this executor. */
  readonly verifiedLanguages: readonly string[];
  /** Languages the executor lists. Listing is not the same as running. */
  readonly installedLanguages: readonly string[];
  readonly detail: string;
  /** Host of the endpoint that answered, for provenance. */
  readonly executor: string;
  readonly probedAt: string;
}

const ExecutionResultSchema = z.object({
  language: z.string(),
  version: z.string(),
  compile: z
    .object({
      stdout: z.string().default(''),
      stderr: z.string().default(''),
      output: z.string().optional(),
      code: z.number().int().nullable().optional(),
      signal: z.string().nullable().optional(),
    })
    .optional(),
  run: z.object({
    stdout: z.string().default(''),
    stderr: z.string().default(''),
    output: z.string().optional(),
    code: z.number().int().nullable().optional(),
    signal: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    cpu_time: z.number().nonnegative().optional(),
    wall_time: z.number().nonnegative().optional(),
    memory: z.number().nonnegative().optional(),
  }),
});

const RuntimeSchema = z.object({
  language: z.string(),
  version: z.string(),
  aliases: z.array(z.string()).optional(),
});

const RuntimeListSchema = z.array(RuntimeSchema);

function fileExtensionFor(language: string): string {
  const normalised = language.toLowerCase();
  if (normalised === 'python' || normalised === 'python3') return 'py';
  if (normalised === 'javascript') return 'js';
  if (normalised === 'typescript') return 'ts';
  if (normalised === 'sql' || normalised === 'sqlite3') return 'sql';
  if (normalised === 'c' || normalised === 'c++' || normalised === 'cpp') return 'cpp';
  if (normalised === 'java') return 'java';
  if (normalised === 'go') return 'go';
  if (normalised === 'rust') return 'rs';
  return 'txt';
}

function parseRetryAfterMs(headers: PistonFetchResponse['headers']): number {
  const raw = headers.get('retry-after');
  if (!raw) return 5_000;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return 5_000;
  return seconds * 1_000;
}

export class PistonClient {
  private readonly fetchImpl: PistonFetch;
  private readonly baseUrls: readonly string[];
  private readonly maxSourceBytes: number;
  private readonly timeoutMs: number;

  constructor(options: PistonClientOptions) {
    this.fetchImpl = options.fetchImpl;
    const primary = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const fallbacks = (options.fallbackBaseUrls ?? []).map((url) => url.replace(/\/+$/, ''));
    this.baseUrls = [...new Set([primary, ...fallbacks])];
    this.maxSourceBytes = options.maxSourceBytes ?? PISTON_MAX_SOURCE_BYTES;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  get baseUrl(): string {
    return this.baseUrls[0] ?? DEFAULT_BASE_URL;
  }

  /**
   * Executes against the primary endpoint and, only on infrastructure failure,
   * against the configured fallbacks in order.
   */
  async execute(request: ExecuteRequest): Promise<PistonOutcome> {
    let last: PistonOutcome = {
      kind: 'infra_error',
      message: 'No executor endpoint is configured.',
    };

    for (const baseUrl of this.baseUrls) {
      last = await this.executeOnce(baseUrl, request);
      if (last.kind !== 'infra_error') return last;
    }

    return last;
  }

  private async executeOnce(baseUrl: string, request: ExecuteRequest): Promise<PistonOutcome> {
    const sourceBytes = Buffer.byteLength(request.source, 'utf8');
    if (request.source.trim().length === 0) {
      return { kind: 'invalid_request', message: 'Source is empty.' };
    }
    if (sourceBytes > this.maxSourceBytes) {
      return {
        kind: 'invalid_request',
        message: `Source is ${sourceBytes} bytes; the bound is ${this.maxSourceBytes}.`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const memoryLimitBytes = request.memoryLimitBytes ?? PISTON_LIMITS.runMemoryLimitBytes;
    let response: PistonFetchResponse;
    try {
      response = await this.fetchImpl(`${baseUrl}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: request.language,
          version: request.version ?? '*',
          files: [{ name: `main.${fileExtensionFor(request.language)}`, content: request.source }],
          stdin: request.stdin ?? '',
          run_timeout: request.runTimeoutMs ?? PISTON_LIMITS.runTimeoutMs,
          run_cpu_time: request.cpuTimeMs ?? PISTON_LIMITS.runCpuTimeMs,
          run_memory_limit: memoryLimitBytes,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      return {
        kind: 'infra_error',
        message: `Executor unreachable: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'unauthorized',
        status: response.status,
        message: 'Execution requires authorization; no code was run.',
      };
    }
    if (response.status === 429) {
      return {
        kind: 'rate_limited',
        message: 'Executor rate limit reached.',
        retryAfterMs: parseRetryAfterMs(response.headers),
      };
    }
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      const body = await response.text().catch(() => '');
      const unsupported = /unknown|unsupported|not supported|no such runtime/i.test(body);
      return unsupported
        ? { kind: 'unsupported_language', message: `Runtime not offered: ${request.language}` }
        : { kind: 'invalid_request', message: `Executor rejected the request (${response.status}).` };
    }
    if (!response.ok) {
      return { kind: 'infra_error', message: `Executor returned ${response.status}.` };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await response.text());
    } catch {
      return { kind: 'infra_error', message: 'Executor returned a malformed body.' };
    }

    const parsed = ExecutionResultSchema.safeParse(raw);
    if (!parsed.success) {
      return { kind: 'infra_error', message: 'Executor response did not match the known shape.' };
    }

    const { language, version, compile, run } = parsed.data;

    if (compile && (compile.code ?? 0) !== 0) {
      return {
        kind: 'compile_error',
        message: compile.stderr || compile.output || 'Compilation failed.',
        language,
        version,
      };
    }

    if (run.status === 'OL') {
      return {
        kind: 'output_limit_exceeded',
        message: 'Program output exceeded the capture limit; the run is inconclusive.',
        language,
        version,
      };
    }

    // A cgroup OOM kill also reports SIGKILL. Check memory before time so a
    // memory kill is never described to a candidate as a timeout.
    const peakMemoryBytes = run.memory ?? 0;
    if (run.code === 137 && peakMemoryBytes >= memoryLimitBytes * 0.95) {
      return {
        kind: 'memory_limit_exceeded',
        message: 'Execution was killed for exceeding the memory limit.',
        peakMemoryBytes,
        language,
        version,
      };
    }

    if (run.status === 'TO') {
      return {
        kind: 'time_limit_exceeded',
        message: 'Execution exceeded the CPU or wall-clock limit.',
        language,
        version,
      };
    }

    if (run.code === 137 || run.signal === 'SIGKILL') {
      return {
        kind: 'killed',
        message: 'The executor killed the process and did not report a limit; the result is withheld.',
        signal: run.signal ?? 'SIGKILL',
        language,
        version,
      };
    }

    if (run.status !== undefined && run.status !== null) {
      return {
        kind: 'runtime_error',
        message: `Execution ended with status ${run.status}.`,
        exitCode: run.code ?? null,
        language,
        version,
      };
    }

    if ((run.code ?? 0) === 0) {
      return {
        kind: 'passed',
        stdout: run.stdout,
        stderr: run.stderr,
        exitCode: 0,
        cpuTimeMs: run.cpu_time ?? 0,
        wallTimeMs: run.wall_time ?? 0,
        memoryBytes: run.memory ?? 0,
        language,
        version,
      };
    }

    return {
      kind: 'runtime_error',
      message: run.stderr || run.output || 'Program exited non-zero.',
      exitCode: run.code ?? null,
      language,
      version,
    };
  }

  /**
   * Reports what the executor will actually allow right now. Used by the Studio
   * UI so a candidate is never shown a "Run" button that cannot work.
   */
  /**
   * Reports what the executor will actually allow right now. Used by the Studio
   * UI so a candidate is never shown a "Run" button that cannot work.
   *
   * "Listed in /runtimes" is not "runnable": each language is verified by
   * executing a tiny program, and an endpoint is only accepted after a real
   * probe. This also iterates configured fallbacks; a healthy secondary must not
   * be reported as unavailable because the primary is down.
   */
  async probeCapability(): Promise<PistonCapability> {
    let best: PistonCapability | null = null;

    for (const baseUrl of this.baseUrls) {
      const result = await this.probeEndpoint(baseUrl);
      if (result.executionAuthorized) return result;
      if (!best || (result.runtimesReachable && !best.runtimesReachable)) best = result;
    }

    return best ?? {
      runtimesReachable: false,
      executionAuthorized: false,
      verifiedLanguages: [],
      installedLanguages: [],
      executor: this.baseUrl,
      probedAt: new Date().toISOString(),
      detail: 'No executor endpoint is configured.',
    };
  }

  private async probeEndpoint(baseUrl: string): Promise<PistonCapability> {
    const executor = baseUrl.replace(/^[a-z]+:\/\//i, '');
    const probedAt = new Date().toISOString();
    const empty = (detail: string, reachable: boolean, installed: readonly string[] = []) => ({
      runtimesReachable: reachable,
      executionAuthorized: false,
      verifiedLanguages: [],
      installedLanguages: installed,
      executor,
      probedAt,
      detail,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    let runtimes: Array<{ language: string; version: string }>;

    try {
      const response = await this.fetchImpl(`${baseUrl}/runtimes`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        return empty(`Runtime catalogue unreachable (status ${response.status}).`, false);
      }
      const parsed = RuntimeListSchema.safeParse(JSON.parse(await response.text()) as unknown);
      if (!parsed.success) {
        return empty('Runtime catalogue returned an unrecognised shape.', false);
      }
      runtimes = parsed.data;
    } catch (error) {
      return empty(
        `Runtime catalogue unreachable: ${error instanceof Error ? error.message : 'unknown'}.`,
        false,
      );
    } finally {
      clearTimeout(timer);
    }

    const installed = [...new Set(runtimes.map((runtime) => runtime.language))];
    if (runtimes.length === 0) {
      return empty('The executor is reachable but no language runtime is installed.', true);
    }

    const probed: string[] = [];
    const failures: string[] = [];

    for (const runtime of runtimes) {
      const source = PROBE_PROGRAMS[runtime.language.toLowerCase()];
      if (!source) {
        failures.push(`${runtime.language} (no probe program defined)`);
        continue;
      }

      const probeController = new AbortController();
      const probeTimer = setTimeout(() => probeController.abort(), PROBE_TIMEOUT_MS);
      try {
        const response = await this.fetchImpl(`${baseUrl}/execute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            language: runtime.language,
            version: runtime.version,
            files: [{ name: `main.${fileExtensionFor(runtime.language)}`, content: source }],
            run_timeout: PISTON_LIMITS.runTimeoutMs,
            run_cpu_time: PISTON_LIMITS.runCpuTimeMs,
            run_memory_limit: PISTON_LIMITS.runMemoryLimitBytes,
          }),
          signal: probeController.signal,
        });

        if (response.status === 401 || response.status === 403) {
          return empty(
            `Runtimes are listed but execution requires authorization (status ${response.status}).`,
            true,
            installed,
          );
        }
        if (!response.ok) {
          failures.push(`${runtime.language} (probe status ${response.status})`);
          continue;
        }

        const parsed = ExecutionResultSchema.safeParse(JSON.parse(await response.text()) as unknown);
        if (!parsed.success) {
          failures.push(`${runtime.language} (unrecognised probe response)`);
          continue;
        }
        if ((parsed.data.compile?.code ?? 0) === 0 && (parsed.data.run.code ?? 0) === 0) {
          probed.push(runtime.language);
        } else {
          failures.push(`${runtime.language} (probe exited ${parsed.data.run.code ?? 'unknown'})`);
        }
      } catch (error) {
        failures.push(
          `${runtime.language} (${error instanceof Error ? error.message : 'probe failed'})`,
        );
      } finally {
        clearTimeout(probeTimer);
      }
    }

    if (probed.length === 0) {
      return empty(
        `The executor lists ${installed.join(', ') || 'no languages'} but none passed a probe: ${failures.join('; ')}.`,
        true,
        installed,
      );
    }

    return {
      runtimesReachable: true,
      executionAuthorized: true,
      verifiedLanguages: probed,
      installedLanguages: installed,
      executor,
      probedAt,
      detail:
        failures.length === 0
          ? 'Execution is authorized.'
          : `Execution is authorized for ${probed.join(', ')}; not runnable: ${failures.join('; ')}.`,
    };
  }
}