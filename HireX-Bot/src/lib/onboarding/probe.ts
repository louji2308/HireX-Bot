import {
  type ProbeLanguage,
  type ProbeResult,
  type ProbeSource,
} from '@/types/phase4_contracts';

export interface PracticeProbeOption {
  readonly value: string;
  readonly label: string;
}

export interface PracticeProbeQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly PracticeProbeOption[];
  readonly explanationPrompt: string;
}

export interface PracticeProbe {
  readonly snippetId: string;
  readonly language: ProbeLanguage;
  readonly source: ProbeSource;
  readonly code: string;
  readonly question: PracticeProbeQuestion;
}

const KEYWORDS = [
  'error',
  'timeout',
  'retry',
  'log',
  'null',
  'exception',
  'fallback',
  'status',
  'catch',
  'observable',
  'recover',
  'caller',
] as const;

const PROBES: Readonly<Record<ProbeLanguage, PracticeProbe>> = {
  typescript: {
    snippetId: 'ts-fetch-profile-v1',
    language: 'typescript',
    source: 'generic_fallback',
    code: `export async function loadProfile(id: string, client: Client) {
  try {
    const response = await client.get(\`/profiles/\${id}\`);
    if (!response.ok) {
      throw new Error(\`profile request failed: \${response.status}\`);
    }
    const body = await response.json();
    return body.profile ?? null;
  } catch (error) {
    console.error('loadProfile failed', error);
    return null;
  }
}

// Callers cannot tell a missing profile from a failed request.`,
    question: {
      id: 'q1',
      prompt: 'What failure does this code handle least well?',
      options: [
        {
          value: 'swallow',
          label:
            'It returns null for both "no profile" and "request failed", so callers cannot tell the cases apart.',
        },
        { value: 'retry', label: 'It retries too aggressively.' },
        { value: 'memory', label: 'It allocates too much memory.' },
        { value: 'none', label: 'It has no failure handling at all.' },
      ],
      explanationPrompt:
        'Explain in 2-3 sentences how you would make the failure observable and recoverable.',
    },
  },
  python: {
    snippetId: 'py-load-profile-v1',
    language: 'python',
    source: 'generic_fallback',
    code: `def load_profile(profile_id, client):
    try:
        response = client.get(f"/profiles/{profile_id}")
        if response.status_code != 200:
            raise RuntimeError(
                f"profile request failed: {response.status_code}"
            )
        payload = response.json()
        return payload.get("profile")
    except (TimeoutError, RuntimeError) as exc:
        log.warning("load_profile failed: %s", exc)
        return None

# Callers cannot tell a missing profile from a failed request.
# A retry here would also repeat a permanent 404 forever.`,
    question: {
      id: 'q1',
      prompt: 'What failure does this code handle least well?',
      options: [
        {
          value: 'swallow',
          label:
            'It returns None for both "no profile" and "request failed", so callers cannot tell the cases apart.',
        },
        { value: 'retry', label: 'It retries every failure forever.' },
        { value: 'memory', label: 'It allocates too much memory.' },
        { value: 'none', label: 'It has no exception handling at all.' },
      ],
      explanationPrompt:
        'Explain in 2-3 sentences how you would make the failure observable and recoverable.',
    },
  },
  java: {
    snippetId: 'java-load-profile-v1',
    language: 'java',
    source: 'generic_fallback',
    code: `public Profile loadProfile(String id, Client client) {
  try {
    Response response = client.get("/profiles/" + id);
    if (response.statusCode() != 200) {
      throw new IllegalStateException(
        "profile request failed: " + response.statusCode()
      );
    }
    return response.body().profile();
  } catch (Exception error) {
    logger.warn("loadProfile failed", error);
    return null;
  }
}

// Callers cannot tell a missing profile from a failed request.`,
    question: {
      id: 'q1',
      prompt: 'What failure does this code handle least well?',
      options: [
        {
          value: 'swallow',
          label:
            'It returns null for both "no profile" and "request failed", so callers cannot tell the cases apart.',
        },
        { value: 'retry', label: 'It retries too aggressively.' },
        { value: 'memory', label: 'It allocates too much memory.' },
        { value: 'none', label: 'It has no exception handling at all.' },
      ],
      explanationPrompt:
        'Explain in 2-3 sentences how you would make the failure observable and recoverable.',
    },
  },
};

export function isProbeLanguage(value: unknown): value is ProbeLanguage {
  return value === 'typescript' || value === 'python' || value === 'java';
}

export function createPracticeProbe(language: ProbeLanguage): PracticeProbe {
  return PROBES[language];
}

export function gradePracticeProbe(input: {
  readonly language: ProbeLanguage;
  readonly mcqChoice: string | null;
  readonly explanation: string;
  readonly completedAt?: string;
  readonly skipped?: boolean;
}): ProbeResult {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const probe = createPracticeProbe(input.language);

  if (input.skipped) {
    return {
      status: 'skipped',
      language: input.language,
      snippetId: probe.snippetId,
      source: probe.source,
      mcqChoice: null,
      explanation: '',
      score: null,
      scoreMethod: 'not_scored',
      verification: 'practice_baseline',
      completedAt,
    };
  }

  const explanation = input.explanation.trim().slice(0, 800);
  const lower = explanation.toLocaleLowerCase('en-IN');
  const keywordHits = KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  const explanationScore = keywordHits >= 3 ? 50 : keywordHits === 2 ? 35 : keywordHits === 1 ? 15 : 0;
  const mcqScore = input.mcqChoice === 'swallow' ? 50 : 0;

  return {
    status: 'completed',
    language: input.language,
    snippetId: probe.snippetId,
    source: probe.source,
    mcqChoice: input.mcqChoice,
    explanation,
    score: mcqScore + explanationScore,
    scoreMethod: 'deterministic_keyword',
    verification: 'practice_baseline',
    completedAt,
  };
}
