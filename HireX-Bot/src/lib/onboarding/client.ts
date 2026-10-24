import type {
  ExtractionResult,
  IntakeDiagnostics,
  IntakeSession,
  ProbeResult,
  SignalId,
} from '@/types/phase4_contracts';

export interface SessionViewResponse {
  readonly session: IntakeSession;
  readonly nextSignalId: SignalId | null;
  readonly chapterProgress: Readonly<Record<string, { resolved: number; total: number }>>;
  readonly diagnostics: IntakeDiagnostics;
  readonly canComplete: boolean;
  readonly unresolvedRequiredSignals: readonly SignalId[];
}

export interface MutationResponse extends SessionViewResponse {
  readonly status: 'applied' | 'duplicate';
}

export interface ExtractResponse extends MutationResponse {
  readonly extraction: ExtractionResult;
  readonly extraction_mode: 'deterministic_text';
  readonly semantic_extraction: false;
}

export interface ProbeResponse extends MutationResponse {
  readonly result: ProbeResult;
}

export interface FanOutPreviewCard {
  readonly lane: 'discovery' | 'application_prep' | 'training';
  readonly title: string;
  readonly status: 'preview';
  readonly summary: string;
  readonly nextAction: string;
}

export interface CompleteResponse extends MutationResponse {
  readonly completion: NonNullable<IntakeSession['completion']>;
  readonly fanOutPreview: readonly FanOutPreviewCard[];
  readonly event: {
    readonly name: 'candidate/onboarding.completed';
    readonly payload: unknown;
  };
  readonly delivery: {
    readonly emitted: false;
    readonly durable: false;
    readonly source: 'local_preview';
    readonly reason: string;
  };
}

export class OnboardingApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'OnboardingApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? (payload as { error?: { code?: string; message?: string } }).error
        : undefined;
    throw new OnboardingApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'The request did not complete.',
    );
  }

  return payload as T;
}

export async function loadSession(): Promise<SessionViewResponse | null> {
  return apiRequest<SessionViewResponse | { session: null }>('/api/onboarding/session').then(
    (result) => ('session' in result && result.session ? (result as SessionViewResponse) : null),
  );
}

export async function startSession(): Promise<SessionViewResponse> {
  return apiRequest<SessionViewResponse>('/api/onboarding/session', { method: 'POST' });
}
