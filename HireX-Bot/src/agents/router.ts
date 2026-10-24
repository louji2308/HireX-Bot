import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  MODEL_IDS,
  OUTPUT_KIND_COMPATIBILITY,
  ROUTER_LIMITS,
  RouterError,
  TASK_MODEL_MAP,
  WIRE_FORMAT,
  isCertifiableTaskClass,
  isOutputKind,
  isTaskClass,
  type AttemptOutcome,
  type BudgetLevel,
  type BudgetReservation,
  type BudgetSnapshot,
  type ChatMessage,
  type CloudInferenceSource,
  type DegradedReason,
  type InferenceSource,
  type RouteAttempt,
  type RouteEvidence,
  type RouteFailure,
  type RouteRequest,
  type RouteResult,
  type RouterConfig,
  type RouterErrorCode,
  type RouteStage,
  type SmartCodeRouterFactory,
  type TokenUsage,
  type VerificationTier,
} from '@/types/phase1_contracts';

const CLOSE_TAG_PATTERN = /<\s*\/\s*untrusted[\s_-]*data\s*>/i;

const L3_ALLOWED_TASKS = new Set(['RESPONSE_GRADING', 'CONVERSATION_SOCRATIC']);

const LEVEL_OUTPUT_FACTOR: Readonly<Record<BudgetLevel, number>> = {
  L0: 1,
  L1: 0.75,
  L2: 0.5,
  L3: 0.25,
  L4: 0.25,
};

const GatewayEnvelopeSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
        finish_reason: z.string().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

interface BreakerState {
  failures: number;
  openUntilMs: number | null;
}

class RouterFailureSignal extends Error {
  readonly routerError: RouterError;

  constructor(routerError: RouterError) {
    super(routerError.message);
    this.name = 'RouterFailureSignal';
    this.routerError = routerError;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function modelIdOf(source: InferenceSource, config: RouterConfig): string {
  return source === 'ollama-local' ? config.ollamaModelId : MODEL_IDS[source];
}

function estimateTokens(value: string, charsPerToken: number): number {
  const safeDivisor = charsPerToken > 0 ? charsPerToken : 4;
  return Math.ceil((value.length / safeDivisor) * 1.15);
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function backoffMs(config: RouterConfig, attempt: number, random: () => number): number {
  const exponential = Math.min(
    config.backoff.maxMs,
    config.backoff.baseMs * config.backoff.factor ** Math.max(0, attempt - 1),
  );
  const jitter = 1 + random() * config.backoff.jitterRatio;
  return Math.max(0, Math.round(exponential * jitter));
}

function verificationTierFor(source: InferenceSource, primary: CloudInferenceSource): VerificationTier {
  if (source === 'ollama-local') return 'local';
  return source === primary ? 'cloud-primary' : 'cloud-failover';
}

function terminalCode(attempts: readonly RouteAttempt[]): RouterErrorCode {
  if (attempts.some((attempt) => attempt.outcome === 'schema_invalid')) return 'MALFORMED_OUTPUT';
  if (attempts.some((attempt) => attempt.outcome === 'rate_limited')) return 'UPSTREAM_RATE_LIMITED';
  if (attempts.some((attempt) => attempt.outcome === 'timeout')) return 'UPSTREAM_TIMEOUT';
  if (attempts.length > 0 && attempts.every((attempt) => attempt.outcome === 'circuit_open')) {
    return 'ALL_MODELS_UNAVAILABLE';
  }
  return 'UPSTREAM_UNAVAILABLE';
}

function schemaIdentity(taskClass: string, outputKind: string, description: string | undefined): string {
  return sha256(`${taskClass}:${outputKind}:${description ?? 'undeclared'}`);
}

function fail(
  code: RouterErrorCode,
  stage: RouteStage,
  message: string,
  extra: {
    retryable?: boolean;
    retryAfterMs?: number;
    detail?: Record<string, string | number | boolean | null | readonly string[]>;
    attempts?: number;
  } = {},
): never {
  throw new RouterFailureSignal(
    new RouterError({
      code,
      stage,
      message,
      retryable: extra.retryable ?? false,
      retryAfterMs: extra.retryAfterMs,
      detail: extra.detail,
      attempts: extra.attempts,
    }),
  );
}

export const createSmartCodeRouter: SmartCodeRouterFactory = (deps) => {
  const { clock, transport, budget, logger, prompts, envelope, config } = deps;
  const random = deps.random ?? Math.random;
  const localBreakers = new Map<CloudInferenceSource, BreakerState>();

  const readBreaker = async (source: CloudInferenceSource): Promise<BreakerState> => {
    if (deps.circuit) return deps.circuit.get(source);
    return localBreakers.get(source) ?? { failures: 0, openUntilMs: null };
  };

  const writeBreaker = async (source: CloudInferenceSource, state: BreakerState): Promise<void> => {
    if (deps.circuit) {
      await deps.circuit.set(source, state);
      return;
    }
    localBreakers.set(source, state);
  };

  const isOpen = async (source: CloudInferenceSource): Promise<boolean> => {
    const state = await readBreaker(source);
    return state.openUntilMs !== null && clock.now() < state.openUntilMs;
  };

  const recordFailure = async (source: CloudInferenceSource): Promise<void> => {
    const state = await readBreaker(source);
    const failures = state.failures + 1;
    const openUntilMs =
      failures >= config.circuit.failureThreshold
        ? clock.now() + config.circuit.cooldownMs
        : state.openUntilMs;
    await writeBreaker(source, { failures: failures >= config.circuit.failureThreshold ? 0 : failures, openUntilMs });
  };

  const recordSuccess = async (source: CloudInferenceSource): Promise<void> => {
    await writeBreaker(source, { failures: 0, openUntilMs: null });
  };

  return {
    async route<T>(request: RouteRequest<T>): Promise<RouteResult<T>> {
      const startedAt = clock.now();
      const attempts: RouteAttempt[] = [];
      let reservation: BudgetReservation | null = null;
      let snapshot: BudgetSnapshot | null = null;
      let transportAttempted = false;
      let spentTokens = 0;
      let settled = false;

      const settle = async (): Promise<boolean> => {
        if (!reservation || settled) return settled;
        try {
          const settlement = await budget.settle(request.scope, request.requestId, spentTokens);
          settled = true;
          return settlement.ok;
        } catch (error) {
          logger.error('budget settlement failed', {
            requestId: request.requestId,
            reason: error instanceof Error ? error.name : 'unknown',
          });
          return false;
        }
      };

      try {
        /* ------------------------------ validate ----------------------------- */
        if (!isTaskClass(request.taskClass)) {
          fail('INVALID_REQUEST', 'validate', 'Unknown task class.');
        }
        if (!isOutputKind(request.outputKind)) {
          fail('INVALID_REQUEST', 'validate', 'Unknown output kind.');
        }
        if (!OUTPUT_KIND_COMPATIBILITY[request.taskClass].includes(request.outputKind)) {
          fail(
            'INTENT_SPLIT_REQUIRED',
            'validate',
            'A single turn cannot both probe and score. Issue two calls.',
            {
              detail: { taskClass: request.taskClass, outputKind: request.outputKind },
            },
          );
        }
        if (
          request.requestId.length === 0 ||
          request.requestId.length > ROUTER_LIMITS.maxRequestIdChars
        ) {
          fail('INVALID_REQUEST', 'validate', 'requestId is missing or too long.');
        }
        if (request.prompt.untrusted.length > ROUTER_LIMITS.maxUntrustedParts) {
          fail('INVALID_REQUEST', 'validate', 'Too many untrusted parts.');
        }
        if (request.prompt.instruction.length > ROUTER_LIMITS.maxInstructionChars) {
          fail('INVALID_REQUEST', 'validate', 'Instruction exceeds the character bound.');
        }
        const untrustedBytes = request.prompt.untrusted.reduce(
          (total, part) => total + Buffer.byteLength(part.content, 'utf8'),
          0,
        );
        if (untrustedBytes > ROUTER_LIMITS.maxUntrustedBytes) {
          fail('INVALID_REQUEST', 'validate', 'Untrusted payload exceeds the byte bound.');
        }
        if (!request.outputSchema) {
          fail('INVALID_REQUEST', 'validate', 'outputSchema is required.');
        }

        const template = prompts.get(request.prompt.templateId);
        if (!template) {
          fail('UNKNOWN_PROMPT_TEMPLATE', 'validate', 'Prompt template is not registered.', {
            detail: { templateId: request.prompt.templateId },
          });
        }

        /* ------------------------------ compose ------------------------------ */
        let wrapped: string[];
        try {
          wrapped = request.prompt.untrusted.map((part) => envelope.wrap(part));
        } catch {
          fail('ENVELOPE_FAILED', 'compose', 'Untrusted content could not be safely wrapped.');
        }

        if (wrapped.some((part) => CLOSE_TAG_PATTERN.test(part.replace(/<\/untrusted-data>$/i, '')))) {
          fail('ENVELOPE_FAILED', 'compose', 'Envelope contained a premature delimiter.');
        }

        const systemPrompt = template.system;
        const userContent = [request.prompt.instruction, ...wrapped].filter(Boolean).join('\n\n');
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ];

        const primary = TASK_MODEL_MAP[request.taskClass];
        const alternate: CloudInferenceSource =
          primary === 'haiku-4.5' ? 'gpt-5-codex' : 'haiku-4.5';

        let candidates: InferenceSource[] = request.strictPrimary
          ? [primary]
          : config.allowLocalFallback
            ? [primary, alternate, 'ollama-local']
            : [primary, alternate];

        /* ------------------------------- budget ------------------------------ */
        snapshot = await budget.snapshot(request.scope);

        if (snapshot.level === 'L4') {
          if (isCertifiableTaskClass(request.taskClass)) {
            fail(
              'LOCAL_INSUFFICIENT',
              'budget',
              'Certifiable assessment requires a cloud model; local inference cannot be certified.',
              { detail: { level: 'L4', taskClass: request.taskClass } },
            );
          }
          if (!config.allowLocalFallback) {
            fail('BUDGET_EXHAUSTED', 'budget', 'Cloud budget exhausted and local mode is disabled.');
          }
          candidates = ['ollama-local'];
        } else if (snapshot.level === 'L3' && !L3_ALLOWED_TASKS.has(request.taskClass)) {
          fail('BUDGET_DEFERRED', 'budget', 'Cloud budget is conserving; retry once budget recovers.', {
            retryable: true,
            detail: { level: 'L3', taskClass: request.taskClass },
          });
        }

        const cloudCandidates = candidates.filter((source) => source !== 'ollama-local');

        if (request.strictPrimary && cloudCandidates.length === 1 && (await isOpen(primary))) {
          fail(
            'STRICT_PRIMARY_UNAVAILABLE',
            'budget',
            'The required primary lab is unavailable; proctored mode cannot degrade.',
          );
        }

        const requestedOutput = request.maxOutputTokens ?? config.defaultMaxOutputTokens[request.taskClass];
        const outputCap = Math.max(
          64,
          Math.floor(
            Math.min(requestedOutput, snapshot.callLimitTokens, ROUTER_LIMITS.maxOutputTokensCeiling) *
              LEVEL_OUTPUT_FACTOR[snapshot.level],
          ),
        );
        const schemaRetries =
          snapshot.level === 'L0'
            ? config.maxSchemaRetries
            : snapshot.level === 'L1'
              ? Math.min(1, config.maxSchemaRetries)
              : 0;

        if (cloudCandidates.length > 0) {
          const reserved = await budget.reserve(request.scope, request.requestId, outputCap);
          if (!reserved.ok) {
            fail('BUDGET_EXHAUSTED', 'budget', 'Token budget denied the request.', {
              detail: { reason: reserved.denial.reason, level: reserved.denial.snapshot.level },
            });
          }
          reservation = reserved.reservation;
          snapshot = reserved.reservation.snapshot;
        }

        if (request.signal?.aborted) {
          fail('ABORTED', 'transport', 'The request was aborted before dispatch.');
        }

        /* ------------------------------ dispatch ----------------------------- */
        let usedRepair = false;
        let retryAfterMs: number | undefined;

        for (const source of candidates) {
          if (attempts.length >= config.maxTotalAttempts) break;
          const isLocal = source === 'ollama-local';

          if (!isLocal && (await isOpen(source))) {
            attempts.push({
              source,
              modelId: modelIdOf(source, config),
              attempt: 1,
              outcome: 'circuit_open',
              latencyMs: 0,
            });
            continue;
          }

          let repairTurn: ChatMessage | null = null;

          for (let attempt = 1; attempt <= config.maxAttemptsPerModel; attempt += 1) {
            if (attempts.length >= config.maxTotalAttempts) break;
            if (clock.now() - startedAt > config.deadlineMs) {
              fail('DEADLINE_EXCEEDED', 'transport', 'The request deadline was exceeded.');
            }

            const attemptStart = clock.now();
            let response;
            transportAttempted = true;

            try {
              response = await transport.complete({
                requestId: request.requestId,
                modelId: modelIdOf(source, config),
                messages: repairTurn ? [...messages, repairTurn] : messages,
                responseFormat: WIRE_FORMAT[request.outputKind],
                temperature: request.temperature ?? 0,
                maxOutputTokens: outputCap,
                timeoutMs: config.timeoutsMs[source],
                signal: request.signal ?? new AbortController().signal,
              });
            } catch (error) {
              if (request.signal?.aborted || isAbortError(error)) {
                attempts.push({
                  source,
                  modelId: modelIdOf(source, config),
                  attempt,
                  outcome: 'timeout',
                  latencyMs: clock.now() - attemptStart,
                });
                fail('ABORTED', 'transport', 'The request was aborted during dispatch.');
              }
              attempts.push({
                source,
                modelId: modelIdOf(source, config),
                attempt,
                outcome: 'transport_error',
                latencyMs: clock.now() - attemptStart,
              });
              if (!isLocal) await recordFailure(source);
              if (attempt < config.maxAttemptsPerModel) {
                await clock.sleep(backoffMs(config, attempt, random), request.signal);
                continue;
              }
              break;
            }

            const usage: TokenUsage = response.usage
              ? { ...response.usage, estimated: false }
              : {
                  inputTokens: estimateTokens(`${systemPrompt}${userContent}`, config.estimatedCharsPerToken),
                  outputTokens: estimateTokens(response.bodyText, config.estimatedCharsPerToken),
                  totalTokens:
                    estimateTokens(`${systemPrompt}${userContent}`, config.estimatedCharsPerToken) +
                    estimateTokens(response.bodyText, config.estimatedCharsPerToken),
                  estimated: true,
                };
            spentTokens += usage.totalTokens;

            const attemptRecord = (outcome: AttemptOutcome, extra?: Partial<RouteAttempt>): RouteAttempt => ({
              source,
              modelId: modelIdOf(source, config),
              attempt,
              outcome,
              latencyMs: clock.now() - attemptStart,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              httpStatus: response.status,
              ...extra,
            });

            if (response.status === 429) {
              retryAfterMs = response.retryAfterMs;
              attempts.push(attemptRecord('rate_limited'));
              break;
            }

            if (response.status === 401 || response.status === 403) {
              attempts.push(attemptRecord('invalid_status'));
              fail('INTERNAL_ERROR', 'transport', 'The SMART-Code gateway rejected our credentials.', {
                detail: { status: response.status },
              });
            }

            if (response.status >= 500 || response.status === 408 || response.status === 504) {
              attempts.push(attemptRecord(response.status === 408 || response.status === 504 ? 'timeout' : 'transport_error'));
              if (!isLocal) await recordFailure(source);
              if (attempt < config.maxAttemptsPerModel) {
                await clock.sleep(backoffMs(config, attempt, random), request.signal);
                continue;
              }
              break;
            }

            if (response.status < 200 || response.status >= 300) {
              attempts.push(attemptRecord('invalid_status'));
              break;
            }

            /* ----------------------------- parse ---------------------------- */
            const gateway = GatewayEnvelopeSchema.safeParse(tryParseJson(response.bodyText));
            if (!gateway.success) {
              attempts.push(attemptRecord('schema_invalid', { validationIssues: zodIssues(gateway.error) }));
              if (!isLocal) await recordFailure(source);
              repairTurn = {
                role: 'user',
                content: `Your previous reply was not a valid gateway response. Reply again with RAW JSON only.\n\nPrevious reply:\n${envelope.wrap({ source: 'model_output', content: response.bodyText.slice(0, 4_000) })}`,
              };
              usedRepair = true;
              if (attempt <= schemaRetries) continue;
              break;
            }

            const content = gateway.data.choices[0]?.message.content ?? '';
            if (content.trim().length === 0) {
              attempts.push(
                attemptRecord('schema_invalid', { validationIssues: ['content: empty response'] }),
              );
              if (!isLocal) await recordFailure(source);
              if (attempt <= schemaRetries) continue;
              break;
            }

            const wire = WIRE_FORMAT[request.outputKind];
            const parsedJson = tryParseJson(content);
            const rawCandidates: unknown[] = wire === 'json' ? [parsedJson] : [content, parsedJson];

            let match: { readonly data: T } | null = null;
            let issues: string[] = ['<root>: response was not valid JSON'];
            for (const candidate of rawCandidates) {
              if (candidate === undefined) continue;
              const parsedCandidate = request.outputSchema.safeParse(candidate);
              if (parsedCandidate.success) {
                match = { data: parsedCandidate.data };
                break;
              }
              issues = zodIssues(parsedCandidate.error);
            }

            if (!match) {
              attempts.push(attemptRecord('schema_invalid', { validationIssues: issues }));
              if (!isLocal) await recordFailure(source);
              repairTurn = {
                role: 'user',
                content: `Your previous reply did not match the required response shape. Reply again with only the corrected payload.\nValidation issues: ${issues.join('; ')}\n\nPrevious reply:\n${envelope.wrap({ source: 'model_output', content: content.slice(0, 4_000) })}`,
              };
              usedRepair = true;
              if (attempt <= schemaRetries) continue;
              break;
            }

            /* ---------------------------- success --------------------------- */
            if (!isLocal) await recordSuccess(source);
            const budgetSettled = await settle();
            const knownSnapshot = snapshot;
            if (!knownSnapshot) {
              fail('INTERNAL_ERROR', 'settle', 'Budget snapshot was unavailable after dispatch.');
            }
            const finalSnapshot =
              (await budget.snapshot(request.scope).catch(() => null)) ?? knownSnapshot;

            const tier = verificationTierFor(source, primary);
            const degradedReasons: DegradedReason[] = [];
            if (tier === 'cloud-failover') degradedReasons.push('provider-failover');
            if (tier === 'local') degradedReasons.push('local-model');
            if (usedRepair) degradedReasons.push('schema-repair');
            if (snapshot && snapshot.level !== 'L0') degradedReasons.push('budget-conservation');

            const evidence: RouteEvidence = {
              requestId: request.requestId,
              inferenceSource: source,
              modelId: modelIdOf(source, config),
              primarySource: primary,
              verificationTier: tier,
              promptTemplateId: template.id,
              promptHash: sha256(systemPrompt),
              untrustedDigest: sha256(wrapped.join('\u0000')),
              schemaHash: schemaIdentity(
                request.taskClass,
                request.outputKind,
                request.outputSchema.description,
              ),
              budgetLevel: snapshot?.level ?? 'L0',
              usedRepair,
              degradedReasons,
            };

            return {
              ok: true,
              requestId: request.requestId,
              taskClass: request.taskClass,
              outputKind: request.outputKind,
              output: match.data,
              evidence,
              inferenceSource: source,
              modelId: modelIdOf(source, config),
              primarySource: primary,
              verificationTier: tier,
              degraded: degradedReasons.length > 0,
              degradedReasons,
              usage,
              budget: finalSnapshot,
              budgetSettled,
              attempts,
              latencyMs: clock.now() - startedAt,
              completedAt: new Date(clock.now()).toISOString(),
            };
          }
        }

        if (transportAttempted && reservation) {
          await settle();
        }
        fail(terminalCode(attempts), 'transport', 'Every candidate model failed.', {
          retryable: true,
          retryAfterMs,
          attempts: attempts.length,
          detail: { outcomes: attempts.map((attempt) => attempt.outcome) },
        });
      } catch (error) {
        const routerError =
          error instanceof RouterFailureSignal
            ? error.routerError
            : new RouterError({
                code: 'INTERNAL_ERROR',
                stage: 'transport',
                message: 'Unexpected router failure.',
                retryable: false,
                sourceError: error,
              });

        if (reservation) {
          try {
            if (transportAttempted) {
              await settle();
            } else {
              await budget.release(request.scope, request.requestId);
            }
          } catch {
            logger.error('budget cleanup failed', { requestId: request.requestId });
          }
        }

        logger.warn('route failed', {
          requestId: request.requestId,
          code: routerError.code,
          stage: routerError.stage,
          attempts: attempts.length,
        });

        const failure: RouteFailure = {
          ok: false,
          requestId: request.requestId,
          error: routerError,
          attempts,
          budget: snapshot,
          latencyMs: clock.now() - startedAt,
        };
        return failure;
      }
    },
  };
};

export type { SmartCodeRouterContract } from '@/types/phase1_contracts';
