/**
 * Production composition for LLM-backed memory consolidation.
 *
 * Configuration is explicit: no key means `createLlmMemoryRuntimeFromEnvironment`
 * throws instead of silently falling back to deterministic bucketing. That keeps
 * the provenance honest — an `llm` fact always came from the configured API.
 */

import { createPromptRegistry } from '@/agents/prompts';
import { createOpenAiCompatibleTransport } from '@/agents/llm-transport';
import { createSmartCodeRouter } from '@/agents/router';
import { InMemoryBudgetLedger } from '@/lib/swarm/budget-ledger';
import { sanitizeAndWrapUntrusted } from '@/lib/security/untrusted-envelope';
import {
  createLlmConsolidator,
  type LlmConsolidator,
} from '@/lib/memory/llm-consolidator';
import type {
  Clock,
  RouterConfig,
  RouterLogger,
  RouterDeps,
} from '@/types/phase1_contracts';

export type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigurationError';
  }
}

export interface LlmMemoryRuntime extends LlmConsolidator {
  readonly providerHost: string;
  readonly models: Readonly<Record<string, string>>;
}

export interface LlmMemoryRuntimeOptions {
  readonly fetchImpl?: typeof fetch;
  readonly clock?: Clock;
  readonly logger?: RouterLogger;
  readonly budget?: InMemoryBudgetLedger;
}

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        },
        { once: true },
      );
    }),
};

const silentLogger: RouterLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function readApiKey(env: EnvironmentLike): string | null {
  const value = env.HIREX_LLM_API_KEY?.trim() || env.SMART_CODE_API_KEY?.trim();
  return value ? value : null;
}

function readBaseUrl(env: EnvironmentLike): string | null {
  const value = env.HIREX_LLM_BASE_URL?.trim() || env.SMART_CODE_BASE_URL?.trim();
  return value ? value : null;
}

export function isLlmMemoryConfigured(env: EnvironmentLike): boolean {
  return readApiKey(env) !== null && readBaseUrl(env) !== null;
}

function routerConfig(env: EnvironmentLike): RouterConfig {
  const ollamaModelId = env.HIREX_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:7b';
  return {
    maxAttemptsPerModel: 2,
    maxSchemaRetries: 1,
    maxTotalAttempts: 4,
    deadlineMs: 45_000,
    timeoutsMs: { 'haiku-4.5': 15_000, 'gpt-5-codex': 25_000, 'ollama-local': 60_000 },
    defaultMaxOutputTokens: {
      CONVERSATION_SOCRATIC: 800,
      LANGUAGE_SCAFFOLD: 400,
      DOCUMENT_EXTRACTION: 1_800,
      JOB_FIT_EXTRACTION: 1_200,
      TRUTHFUL_TAILORING: 1_000,
      AST_ANALYSIS: 3_000,
      CODE_SYNTHESIS: 4_000,
      QUESTION_QC: 4_000,
      RESPONSE_GRADING: 2_000,
    },
    backoff: { baseMs: 250, factor: 2, maxMs: 2_000, jitterRatio: 0.2 },
    circuit: { failureThreshold: 3, cooldownMs: 60_000 },
    allowLocalFallback: false,
    ollamaModelId,
    estimatedCharsPerToken: 4,
  };
}

export function createLlmMemoryRuntimeFromEnvironment(
  env: EnvironmentLike,
  options: LlmMemoryRuntimeOptions = {},
): LlmMemoryRuntime {
  const apiKey = readApiKey(env);
  const baseUrl = readBaseUrl(env);
  if (!apiKey) {
    throw new LlmConfigurationError(
      'LLM consolidation requires HIREX_LLM_API_KEY (or SMART_CODE_API_KEY).',
    );
  }
  if (!baseUrl) {
    throw new LlmConfigurationError(
      'LLM consolidation requires HIREX_LLM_BASE_URL (or SMART_CODE_BASE_URL).',
    );
  }

  const models: Record<string, string> = {};
  const haiku = env.HIREX_LLM_MODEL_HAIKU?.trim();
  const codex = env.HIREX_LLM_MODEL_CODEX?.trim();
  if (haiku) models['claude-haiku-4-5'] = haiku;
  if (codex) models['gpt-5-codex'] = codex;

  const transport = createOpenAiCompatibleTransport({
    apiKey,
    baseUrl,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(Object.keys(models).length > 0 ? { modelOverrides: models } : {}),
  });

  const deps: RouterDeps = {
    clock: options.clock ?? systemClock,
    transport,
    budget:
      options.budget ??
      new InMemoryBudgetLedger({
        grantVerified: env.HIREX_LLM_GRANT_VERIFIED === '1',
      }),
    logger: options.logger ?? silentLogger,
    prompts: createPromptRegistry(),
    envelope: { wrap: (input) => sanitizeAndWrapUntrusted(input.content, input.source) },
    config: routerConfig(env),
  };

  const router = createSmartCodeRouter(deps);
  const consolidator = createLlmConsolidator({
    router,
    modelLabel: `smart-code:${haiku ?? 'claude-haiku-4-5'}`,
  });

  return {
    ...consolidator,
    providerHost: new URL(baseUrl).host,
    models: Object.freeze({ ...models }),
  };
}
