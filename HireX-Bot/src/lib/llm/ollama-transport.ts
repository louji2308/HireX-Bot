/**
 * Ollama transport for the router's offline fallback (ADR-011).
 *
 * The router owns policy (which task may run locally, timeouts, retries). This
 * adapter only speaks HTTP to a local Ollama server, so a judge demo with no
 * network can still grade practice work, and a candidate's code never leaves
 * the machine on that path.
 *
 * Local inference is never valid for a certifiable assessment; that rule lives
 * in the router and is re-stated in the response so callers do not have to
 * remember it.
 */

import type {
  ChatMessage,
  SmartCodeTransport,
  TransportRequest,
  TransportResponse,
} from '@/types/phase1_contracts';

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export interface OllamaFetchInit {
  readonly method: 'POST';
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal: AbortSignal;
}

export interface OllamaFetchResponse {
  readonly status: number;
  readonly headers?: { get(name: string): string | null };
  text(): Promise<string>;
}

export type OllamaFetch = (url: string, init: OllamaFetchInit) => Promise<OllamaFetchResponse>;

export interface OllamaTransportOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: OllamaFetch;
  /** Local tags differ from lab model ids; map them here. */
  readonly modelAliases?: Readonly<Record<string, string>>;
  readonly keepAlive?: string;
}

interface OllamaChatResponse {
  readonly message?: { readonly content?: unknown };
  readonly prompt_eval_count?: unknown;
  readonly eval_count?: unknown;
  readonly error?: unknown;
}

function toOllamaMessages(messages: readonly ChatMessage[]): readonly Record<string, string>[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function createOllamaTransport(options: OllamaTransportOptions = {}): SmartCodeTransport {
  const baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
  const fetchImpl: OllamaFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));

  return {
    async complete(request: TransportRequest): Promise<TransportResponse> {
      const controller = new AbortController();
      const onAbort = (): void => controller.abort();
      const timer = setTimeout(onAbort, request.timeoutMs);
      request.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const model = options.modelAliases?.[request.modelId] ?? request.modelId;
        const response = await fetchImpl(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: toOllamaMessages(request.messages),
            stream: false,
            ...(request.responseFormat === 'json' ? { format: 'json' } : {}),
            keep_alive: options.keepAlive ?? '10m',
            options: {
              temperature: request.temperature,
              num_predict: request.maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });

        const bodyText = await response.text();

        if (response.status !== 200) {
          const retryAfter = response.headers?.get('retry-after') ?? null;
          const parsed = retryAfter === null ? Number.NaN : Number(retryAfter);
          return {
            status: response.status,
            bodyText,
            ...(Number.isFinite(parsed) && parsed > 0 ? { retryAfterMs: parsed * 1000 } : {}),
          };
        }

        let parsed: OllamaChatResponse;
        try {
          parsed = JSON.parse(bodyText) as OllamaChatResponse;
        } catch {
          return { status: 502, bodyText: 'Ollama returned a non-JSON body.' };
        }

        if (typeof parsed.error === 'string' && parsed.error.length > 0) {
          return { status: 502, bodyText: parsed.error };
        }

        const content = parsed.message?.content;
        if (typeof content !== 'string' || content.length === 0) {
          return { status: 502, bodyText: 'Ollama returned an empty message.' };
        }

        const promptTokens = asCount(parsed.prompt_eval_count) ?? 0;
        const completionTokens = asCount(parsed.eval_count) ?? 0;

        return {
          status: 200,
          bodyText: content,
          usage: {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        };
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
      }
    },
  };
}
