import { describe, expect, it } from 'vitest';

import {
  createPracticeProbe,
  gradePracticeProbe,
  isProbeLanguage,
} from '@/lib/onboarding/probe';

describe('Phase 4 code-ownership probe', () => {
  it('serves a generic fallback snippet and never exposes a correct-answer flag', () => {
    const probe = createPracticeProbe('typescript');
    expect(probe.source).toBe('generic_fallback');
    expect(probe.code).toContain('loadProfile');
    expect(probe.question.options).toHaveLength(4);
    expect(JSON.stringify(probe)).not.toContain('"correct"');
  });

  it('scores the correct choice plus three keywords deterministically', () => {
    const result = gradePracticeProbe({
      language: 'python',
      mcqChoice: 'swallow',
      explanation: 'Catch the timeout error, log the exception and return a recoverable status.',
      completedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      status: 'completed',
      language: 'python',
      mcqChoice: 'swallow',
      score: 100,
      scoreMethod: 'deterministic_keyword',
      verification: 'practice_baseline',
      completedAt: '2026-05-01T00:00:00.000Z',
    });
  });

  it('scores a wrong choice without inventing partial credit', () => {
    const result = gradePracticeProbe({
      language: 'java',
      mcqChoice: 'retry',
      explanation: '',
    });
    expect(result.score).toBe(0);
  });

  it('records a skip with no score', () => {
    const result = gradePracticeProbe({
      language: 'typescript',
      mcqChoice: null,
      explanation: 'I would rather skip this.',
      skipped: true,
    });
    expect(result).toMatchObject({
      status: 'skipped',
      score: null,
      scoreMethod: 'not_scored',
      explanation: '',
    });
  });

  it('accepts only the three declared languages', () => {
    expect(isProbeLanguage('typescript')).toBe(true);
    expect(isProbeLanguage('python')).toBe(true);
    expect(isProbeLanguage('java')).toBe(true);
    expect(isProbeLanguage('rust')).toBe(false);
  });
});
