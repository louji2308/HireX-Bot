/**
 * OpenAI-compatible transport for the SMART-Code router.
 *
 * The gateway contract is deliberately narrow: this adapter only performs the
 * HTTP exchange and reports status, body and usage. Retry, failover, schema
 * validation and budgeting stay in `src/agents/router.ts`.
 */

import type {
  SmartCodeTransport,
  TransportRequest,
  TransportResponse,
} from '@/types/phase1_contracts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenAiCompatibleTransportOptions {
  readonly apiKey: string;
  /** Base URL including the version segment, e.g. `https://api.openai.com/v1`. */
  readonly baseUrl: string;
  readonly fetchImpl?: FetchLike;
  /** Optional provider-specific model ids keyed by the router's wire model id. */
  readonly modelOverrides?: Readonly<Record<string, string>>;
}

export class LlmTransportConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmTransportConfigurationError';
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(trimmed) && !/^http:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/i.test(trimmed)) {
    throw new LlmTransportConfigurationError(
      'HIREX_LLM_BASE_URL must be HTTPS (plain HTTP is allowed only for 127.0.0.1).',
    );
  }
  return trimmed;
}

function parseUsage(bodyText: string): TransportResponse['usage'] {
  try {
    const parsed = JSON.parse(bodyText) as {
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
    };
    const usage = parsed.usage;
    if (!usage) return undefined;
    const input = usage.prompt_tokens;
    const output = usage.completion_tokens;
    const total = usage.total_tokens;
    if (
      typeof input !== 'number' ||
      typeof output !== 'number' ||
      typeof total !== 'number' ||
      !Number.isFinite(input) ||
      !Number.isFinite(output) ||
      !Number.isFinite(total)
    ) {
      return undefined;
    }
    return {
      inputTokens: Math.max(0, Math.trunc(input)),
      outputTokens: Math.max(0, Math.trunc(output)),
      totalTokens: Math.max(0, Math.trunc(total)),
    };
  } catch {
    return undefined;
  }
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  return undefined;
}

export function createOpenAiCompatibleTransport(
  options: OpenAiCompatibleTransportOptions,
): SmartCodeTransport {
  if (!options.apiKey.trim()) {
    throw new LlmTransportConfigurationError('HIREX_LLM_API_KEY is required.');
  }
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const overrides = options.modelOverrides ?? {};

  return {
    async complete(request: TransportRequest): Promise<TransportResponse> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs);
      const onAbort = (): void => controller.abort();
      if (request.signal.aborted) controller.abort();
      request.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const body = {
          model: overrides[request.modelId] ?? request.modelId,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        };

        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const bodyText = await response.text();
        const usage = parseUsage(bodyText);
        const retry = retryAfterMs(response);
        return {
          status: response.status,
          bodyText,
          ...(retry === undefined ? {} : { retryAfterMs: retry }),
          ...(usage === undefined ? {} : { usage }),
        };
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
      }
    },
  };
}
