/**
 * PHASE 1 FROZEN CONTRACT
 *
 * Consumers: src/agents/**, src/lib/**, tests/phase1/**
 * Status: FROZEN for the Phase 1 coding wave. Changes require an evidenced
 * change request reviewed by the Orchestrator (AGENTS.md §8.2).
 *
 * Sources:
 *  - Build Plan.md:136-191 (Phase 1 scope, Step 1.1-1.5)
 *  - Architecture.md ADR-002 (dual-lab SMART-Code routing), ADR-006 (Piston), ADR-011 (Ollama)
 *  - AGENTS.md §11 (memory), §12 (evidence integrity), §14 (human approval, secrets)
 *  - Design.md §2 and §10 (monochrome tokens, radii, typography)
 *
 * Invariant enforced by this file: a caller cannot observe a degraded, local or
 * unvalidated result as if it were a verified primary-cloud result. `RouteFailure`
 * has no `output` field, and `RouteSuccess` always carries `evidence`.
 */

import type { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Inference sources                                                   */
/* ------------------------------------------------------------------ */

export const INFERENCE_SOURCES = ['haiku-4.5', 'gpt-5-codex', 'ollama-local'] as const;
export type InferenceSource = (typeof INFERENCE_SOURCES)[number];

export const CLOUD_INFERENCE_SOURCES = ['haiku-4.5', 'gpt-5-codex'] as const;
export type CloudInferenceSource = (typeof CLOUD_INFERENCE_SOURCES)[number];

/** Wire identifiers sent to the SMART-Code gateway. */
export const MODEL_IDS: Readonly<Record<InferenceSource, string>> = {
  'haiku-4.5': 'claude-haiku-4-5',
  'gpt-5-codex': 'gpt-5-codex',
  'ollama-local': 'qwen2.5-coder:7b',
};

/**
 * How the result was produced. `cloud-primary` is the only tier that may be
 * presented as an employer-facing assessment artifact without a disclosure.
 */
export const VERIFICATION_TIERS = ['cloud-primary', 'cloud-failover', 'local'] as const;
export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

/* ------------------------------------------------------------------ */
/* Task taxonomy                                                       */
/* ------------------------------------------------------------------ */

export const TASK_CLASSES = [
  'CONVERSATION_SOCRATIC',
  'LANGUAGE_SCAFFOLD',
  'DOCUMENT_EXTRACTION',
  'JOB_FIT_EXTRACTION',
  'TRUTHFUL_TAILORING',
  'AST_ANALYSIS',
  'CODE_SYNTHESIS',
  'QUESTION_QC',
  'RESPONSE_GRADING',
] as const;
export type TaskClass = (typeof TASK_CLASSES)[number];

/** Deterministic primary route. Total by construction. */
export const TASK_MODEL_MAP: Readonly<Record<TaskClass, CloudInferenceSource>> = {
  CONVERSATION_SOCRATIC: 'haiku-4.5',
  LANGUAGE_SCAFFOLD: 'haiku-4.5',
  DOCUMENT_EXTRACTION: 'haiku-4.5',
  JOB_FIT_EXTRACTION: 'haiku-4.5',
  TRUTHFUL_TAILORING: 'haiku-4.5',
  AST_ANALYSIS: 'gpt-5-codex',
  CODE_SYNTHESIS: 'gpt-5-codex',
  QUESTION_QC: 'gpt-5-codex',
  RESPONSE_GRADING: 'gpt-5-codex',
};

/**
 * Task classes whose output can become hiring evidence (rubric scores, question
 * banks). A local model may never produce these: the router must fail closed.
 * Mirrors AGENTS.md §12.2 and the Mode C provenance rule.
 */
export const CERTIFIABLE_TASK_CLASSES = ['QUESTION_QC', 'RESPONSE_GRADING'] as const;
export type CertifiableTaskClass = (typeof CERTIFIABLE_TASK_CLASSES)[number];

export const OUTPUT_KINDS = [
  'prose',
  'question',
  'translation',
  'structured',
  'code',
  'evaluation',
] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];

/** Rejects a single turn that both probes and scores. */
export const OUTPUT_KIND_COMPATIBILITY: Readonly<Record<TaskClass, readonly OutputKind[]>> = {
  CONVERSATION_SOCRATIC: ['prose', 'question'],
  LANGUAGE_SCAFFOLD: ['translation', 'prose'],
  DOCUMENT_EXTRACTION: ['structured'],
  JOB_FIT_EXTRACTION: ['structured'],
  TRUTHFUL_TAILORING: ['structured', 'prose'],
  AST_ANALYSIS: ['structured', 'prose', 'question'],
  CODE_SYNTHESIS: ['code'],
  QUESTION_QC: ['structured', 'evaluation'],
  RESPONSE_GRADING: ['evaluation'],
};

export const WIRE_FORMAT: Readonly<Record<OutputKind, 'json' | 'text'>> = {
  prose: 'text',
  question: 'text',
  translation: 'text',
  structured: 'json',
  code: 'text',
  evaluation: 'json',
};

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

export const BUDGET_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export interface BudgetScope {
  /** Pseudonymous candidate identifier. Never a name, email or phone number. */
  readonly candidateId: string;
  readonly sessionId: string;
}

export interface BudgetSnapshot {
  readonly level: BudgetLevel;
  /** False while the grant size is unverified; the ledger clamps limits. */
  readonly grantVerified: boolean;
  readonly declaredGrantTokens: number;
  readonly reserveTokens: number;
  /** declaredGrantTokens - reserveTokens, clamped when the grant is unverified. */
  readonly cloudLimitTokens: number;
  readonly cloudSpentTokens: number;
  readonly cloudReservedTokens: number;
  readonly sessionSpentTokens: number;
  readonly sessionLimitTokens: number;
  readonly studentSpentTokens: number;
  readonly studentLimitTokens: number;
  readonly callLimitTokens: number;
}

export interface BudgetReservation {
  readonly reservationId: string;
  readonly reservedTokens: number;
  /** Lease expiry. An unreserved-but-unsettled reservation is reclaimed after this. */
  readonly expiresAtMs: number;
  readonly snapshot: BudgetSnapshot;
}

export type BudgetDenialReason =
  | 'CALL_CAP'
  | 'SESSION_CAP'
  | 'STUDENT_CAP'
  | 'GLOBAL_CAP'
  | 'RESERVE_LOCKED'
  | 'INVALID_AMOUNT';

export interface BudgetDenial {
  readonly reason: BudgetDenialReason;
  readonly snapshot: BudgetSnapshot;
}

export type BudgetReserveResult =
  | { readonly ok: true; readonly reservation: BudgetReservation }
  | { readonly ok: false; readonly denial: BudgetDenial };

export type BudgetSettlementReason =
  | 'UNKNOWN_RESERVATION'
  | 'ALREADY_SETTLED'
  | 'SCOPE_MISMATCH';

export type BudgetSettlement =
  | { readonly ok: true; readonly snapshot: BudgetSnapshot; readonly overageTokens: number }
  | { readonly ok: false; readonly reason: BudgetSettlementReason; readonly snapshot: BudgetSnapshot | null };

/**
 * Implementations MUST:
 *  - make `reserve` atomic with respect to the cap check (no check-then-act across an await);
 *  - settle or release exactly once per `requestId`; repeat calls are no-ops that report the first outcome;
 *  - bind a reservation to its `BudgetScope` and reject foreign settlement;
 *  - reclaim expired leases in `reconcileExpired`.
 */
export interface BudgetLedger {
  snapshot(scope: BudgetScope): Promise<BudgetSnapshot>;
  reserve(scope: BudgetScope, requestId: string, estimatedTokens: number): Promise<BudgetReserveResult>;
  settle(scope: BudgetScope, requestId: string, actualTokens: number): Promise<BudgetSettlement>;
  release(scope: BudgetScope, requestId: string): Promise<void>;
  reconcileExpired(nowMs: number): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Injected runtime dependencies (zero network in tests)               */
/* ------------------------------------------------------------------ */

export interface Clock {
  /** Epoch milliseconds. Virtual time in tests. */
  now(): number;
  /** The only delay primitive the router may use. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface TransportUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface TransportRequest {
  readonly requestId: string;
  readonly modelId: string;
  readonly messages: readonly ChatMessage[];
  readonly responseFormat: 'json' | 'text';
  readonly temperature: number;
  readonly maxOutputTokens: number;
  /** Wall-clock timeout. The transport adapter owns enforcement. */
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface TransportResponse {
  readonly status: number;
  readonly bodyText: string;
  readonly retryAfterMs?: number;
  readonly usage?: TransportUsage;
}

export interface SmartCodeTransport {
  complete(request: TransportRequest): Promise<TransportResponse>;
}

export interface CircuitState {
  readonly failures: number;
  /** Epoch ms; null when closed. */
  readonly openUntilMs: number | null;
}

export interface CircuitStore {
  get(source: CloudInferenceSource): Promise<CircuitState>;
  set(source: CloudInferenceSource, state: CircuitState): Promise<void>;
}

export type LogValue = string | number | boolean | null;
export type LogFields = Readonly<Record<string, LogValue | readonly string[]>>;

/** Logging must never receive prompt text, model output or candidate PII. */
export interface RouterLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export const UNTRUSTED_SOURCES = [
  'resume',
  'job_description',
  'candidate_code',
  'transcript',
  'repository',
  'web_page',
  /** Curated lessons and retrieved failure memories injected as advisory context. */
  'retrieved_memory',
  'candidate_message',
  'model_output',
] as const;
export type UntrustedSource = (typeof UNTRUSTED_SOURCES)[number];

export interface UntrustedInput {
  readonly source: UntrustedSource;
  readonly content: string;
}

/** Implemented by `sanitizeAndWrapUntrusted` in src/lib/security/untrusted-envelope.ts. */
export interface UntrustedEnvelope {
  wrap(input: UntrustedInput): string;
}

export interface PromptTemplate {
  readonly id: string;
  /** Trusted, static system prompt. Never contains candidate data. */
  readonly system: string;
}

export interface PromptRegistry {
  get(templateId: string): PromptTemplate | undefined;
}

export interface PromptSpec {
  readonly templateId: string;
  /** Trusted, authored instruction. Candidate data must live in `untrusted`. */
  readonly instruction: string;
  readonly untrusted: readonly UntrustedInput[];
}

export interface RouterConfig {
  readonly maxAttemptsPerModel: number;
  readonly maxSchemaRetries: number;
  readonly maxTotalAttempts: number;
  /** Single wall-clock budget covering retries, backoff and repair. */
  readonly deadlineMs: number;
  readonly timeoutsMs: Readonly<Record<InferenceSource, number>>;
  readonly defaultMaxOutputTokens: Readonly<Record<TaskClass, number>>;
  readonly backoff: {
    readonly baseMs: number;
    readonly factor: number;
    readonly maxMs: number;
    readonly jitterRatio: number;
  };
  readonly circuit: {
    readonly failureThreshold: number;
    readonly cooldownMs: number;
  };
  readonly allowLocalFallback: boolean;
  readonly ollamaModelId: string;
  readonly estimatedCharsPerToken: number;
}

export const ROUTER_LIMITS = {
  maxUntrustedParts: 32,
  maxUntrustedBytes: 1_000_000,
  maxInstructionChars: 16_000,
  maxRequestIdChars: 128,
  maxOutputTokensCeiling: 8_192,
  /** Upper bound on router-added delay before the alternate lab is dispatched. */
  maxFailoverLatencyMs: 250,
} as const;

/* ------------------------------------------------------------------ */
/* Request / result                                                    */
/* ------------------------------------------------------------------ */

export interface RouteRequest<T> {
  readonly requestId: string;
  readonly taskClass: TaskClass;
  readonly outputKind: OutputKind;
  readonly outputSchema: z.ZodType<T>;
  readonly prompt: PromptSpec;
  readonly scope: BudgetScope;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  /** Proctored Mode C: no cross-lab and no local fallback. */
  readonly strictPrimary?: boolean;
  readonly signal?: AbortSignal;
}

export const ATTEMPT_OUTCOMES = [
  'success',
  'rate_limited',
  'timeout',
  'transport_error',
  'invalid_status',
  'schema_invalid',
  'circuit_open',
  'refusal',
] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

export interface RouteAttempt {
  readonly source: InferenceSource;
  readonly modelId: string;
  /** 1-based per source. */
  readonly attempt: number;
  readonly outcome: AttemptOutcome;
  readonly httpStatus?: number;
  readonly latencyMs: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Zod issue paths and messages only. Never raw model content. */
  readonly validationIssues?: readonly string[];
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  /** True when the gateway omitted usage and the router used its estimator. */
  readonly estimated: boolean;
}

export const DEGRADED_REASONS = [
  'provider-failover',
  'schema-repair',
  'local-model',
  'budget-conservation',
] as const;
export type DegradedReason = (typeof DEGRADED_REASONS)[number];

/**
 * Provenance attached to every successful call. Required so no caller can
 * present a result without stating how it was produced.
 */
export interface RouteEvidence {
  readonly requestId: string;
  readonly inferenceSource: InferenceSource;
  readonly modelId: string;
  readonly primarySource: CloudInferenceSource;
  readonly verificationTier: VerificationTier;
  readonly promptTemplateId: string;
  /** SHA-256 of the trusted system prompt. */
  readonly promptHash: string;
  /** SHA-256 of the sanitised untrusted payload. */
  readonly untrustedDigest: string;
  /** SHA-256 of the JSON schema description used for validation. */
  readonly schemaHash: string;
  readonly budgetLevel: BudgetLevel;
  readonly usedRepair: boolean;
  readonly degradedReasons: readonly DegradedReason[];
}

export interface RouteSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly taskClass: TaskClass;
  readonly outputKind: OutputKind;
  readonly output: T;
  readonly evidence: RouteEvidence;
  readonly inferenceSource: InferenceSource;
  readonly modelId: string;
  readonly primarySource: CloudInferenceSource;
  readonly verificationTier: VerificationTier;
  readonly degraded: boolean;
  readonly degradedReasons: readonly DegradedReason[];
  readonly usage: TokenUsage;
  readonly budget: BudgetSnapshot;
  readonly budgetSettled: boolean;
  readonly attempts: readonly RouteAttempt[];
  readonly latencyMs: number;
  readonly completedAt: string;
}

export interface RouteFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly error: RouterError;
  readonly attempts: readonly RouteAttempt[];
  readonly budget: BudgetSnapshot | null;
  readonly latencyMs: number;
}

export type RouteResult<T> = RouteSuccess<T> | RouteFailure;

export interface SmartCodeRouterContract {
  route<T>(request: RouteRequest<T>): Promise<RouteResult<T>>;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ROUTER_ERROR_CODES = [
  'INVALID_REQUEST',
  'INTENT_SPLIT_REQUIRED',
  'UNKNOWN_PROMPT_TEMPLATE',
  'ENVELOPE_FAILED',
  'BUDGET_DEFERRED',
  'BUDGET_EXHAUSTED',
  'IDEMPOTENCY_CONFLICT',
  'ALL_MODELS_UNAVAILABLE',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'MALFORMED_OUTPUT',
  'MODEL_REFUSAL',
  'STRICT_PRIMARY_UNAVAILABLE',
  'LOCAL_INSUFFICIENT',
  'DEADLINE_EXCEEDED',
  'ABORTED',
  'INTERNAL_ERROR',
] as const;
export type RouterErrorCode = (typeof ROUTER_ERROR_CODES)[number];

export type RouteStage = 'validate' | 'budget' | 'compose' | 'transport' | 'parse' | 'settle';

export interface RouterErrorInit {
  readonly code: RouterErrorCode;
  readonly stage: RouteStage;
  readonly message: string;
  /** True only when retrying the identical request later is safe. */
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly attempts?: number;
  /** Redacted diagnostic fields. Never prompt text or candidate data. */
  readonly detail?: LogFields;
  readonly sourceError?: unknown;
}

export class RouterError extends Error {
  readonly code: RouterErrorCode;
  readonly stage: RouteStage;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly attempts: number;
  readonly detail?: LogFields;
  readonly sourceError?: unknown;

  constructor(init: RouterErrorInit) {
    super(init.message);
    this.name = 'RouterError';
    this.code = init.code;
    this.stage = init.stage;
    this.retryable = init.retryable;
    this.retryAfterMs = init.retryAfterMs;
    this.attempts = init.attempts ?? 0;
    this.detail = init.detail;
    this.sourceError = init.sourceError;
  }
}

/* ------------------------------------------------------------------ */
/* Dependency bundle                                                   */
/* ------------------------------------------------------------------ */

export interface RouterDeps {
  readonly clock: Clock;
  readonly transport: SmartCodeTransport;
  readonly budget: BudgetLedger;
  readonly logger: RouterLogger;
  readonly prompts: PromptRegistry;
  readonly envelope: UntrustedEnvelope;
  readonly config: RouterConfig;
  /** Optional; the router falls back to a process-local breaker. */
  readonly circuit?: CircuitStore;
  /** Injectable for deterministic jitter. Defaults to Math.random. */
  readonly random?: () => number;
}

export type SmartCodeRouterFactory = (deps: RouterDeps) => SmartCodeRouterContract;

/* ------------------------------------------------------------------ */
/* Runtime guards                                                      */
/* ------------------------------------------------------------------ */

export function isTaskClass(value: unknown): value is TaskClass {
  return typeof value === 'string' && (TASK_CLASSES as readonly string[]).includes(value);
}

export function isOutputKind(value: unknown): value is OutputKind {
  return typeof value === 'string' && (OUTPUT_KINDS as readonly string[]).includes(value);
}

export function isInferenceSource(value: unknown): value is InferenceSource {
  return typeof value === 'string' && (INFERENCE_SOURCES as readonly string[]).includes(value);
}

export function isBudgetLevel(value: unknown): value is BudgetLevel {
  return typeof value === 'string' && (BUDGET_LEVELS as readonly string[]).includes(value);
}

export function isCertifiableTaskClass(value: TaskClass): value is CertifiableTaskClass {
  return (CERTIFIABLE_TASK_CLASSES as readonly string[]).includes(value);
}

/**
 * True only when the result may back a candidate-facing claim of measured
 * performance. A `local` tier result is never certifiable.
 */
export function isCertifiableResult(result: RouteResult<unknown>): boolean {
  return (
    result.ok &&
    isCertifiableTaskClass(result.taskClass) &&
    result.verificationTier !== 'local'
  );
}
