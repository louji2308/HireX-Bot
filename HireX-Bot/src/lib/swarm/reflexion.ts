/**
 * Reflexion agent post-mortem (Build Plan.md Step 1.5.2).
 *
 * A lesson is a claim about *why* something failed. This module refuses to
 * synthesise that claim from a stack trace: the failure record supplies the
 * evidence, and the analysis (root cause + prevention rule) must be supplied by
 * the reviewing agent. A drafted lesson is `unverified` until the regression
 * test that proves the rule actually passes; only then can it be promoted.
 */

import { createHash } from 'node:crypto';
import { appendLesson, type Lesson } from '@/lib/swarm/lessons';

export interface FailureRecord {
  readonly phase: number;
  readonly module: string;
  readonly taskId: string | null;
  /** Stable identity of the failing check, e.g. a test name. */
  readonly test: string;
  readonly errorMessage: string;
  readonly filePaths: readonly string[];
  readonly runId: string;
  readonly agentRole?: string;
}

export interface ReflexionAnalysis {
  readonly rootCause: string;
  readonly preventionRule: string;
  /** The test that would fail again without the fix. */
  readonly regressionTest: string;
  readonly confidence: number;
}

export type ReflexionErrorCode = 'MISSING_EVIDENCE' | 'MISSING_ANALYSIS' | 'NOT_REPRODUCED';

export class ReflexionError extends Error {
  readonly code: ReflexionErrorCode;

  constructor(code: ReflexionErrorCode, message: string) {
    super(message);
    this.name = 'ReflexionError';
    this.code = code;
  }
}

export function lessonIdFor(failure: FailureRecord): string {
  const digest = createHash('sha256')
    .update(`${failure.phase}|${failure.module}|${failure.test}|${failure.errorMessage}`, 'utf8')
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `L-${digest}`;
}

export function draftReflexion(
  failure: FailureRecord,
  analysis: ReflexionAnalysis,
  now: () => Date = () => new Date(),
): Lesson {
  if (!failure.errorMessage.trim() || !failure.test.trim()) {
    throw new ReflexionError(
      'MISSING_EVIDENCE',
      'A reflexion needs the failing check and its observed error; neither may be empty.',
    );
  }
  if (!analysis.rootCause.trim() || !analysis.preventionRule.trim()) {
    throw new ReflexionError(
      'MISSING_ANALYSIS',
      'Root cause and prevention rule must be stated explicitly; this module does not invent them.',
    );
  }
  if (!analysis.regressionTest.trim()) {
    throw new ReflexionError(
      'NOT_REPRODUCED',
      'A lesson without a regression test cannot be verified later.',
    );
  }

  const createdAt = now().toISOString();

  return {
    schema_version: 1,
    lesson_id: lessonIdFor(failure),
    phase: failure.phase,
    module: failure.module,
    task_id: failure.taskId,
    root_cause: analysis.rootCause.trim(),
    prevention_rule: analysis.preventionRule.trim(),
    confidence: Math.min(1, Math.max(0, analysis.confidence)),
    verification_state: 'unverified',
    provenance: {
      source: 'sandbox_failure',
      agent_role: failure.agentRole ?? 'Critic-Reflexion',
      run_id: failure.runId,
      commit_sha: null,
      file_paths: [...failure.filePaths],
      evidence_ref: failure.test,
    },
    regression_test: analysis.regressionTest.trim(),
    created_at: createdAt,
    verified_at: null,
    tags: ['reflexion', failure.module],
    supersedes: null,
  };
}

export interface PromotionEvidence {
  readonly regressionTestPassed: boolean;
  /** Command and result, recorded for the progress ledger and the lesson. */
  readonly command: string;
}

export function promoteReflexion(
  lesson: Lesson,
  evidence: PromotionEvidence,
  now: () => Date = () => new Date(),
): Lesson {
  if (lesson.verification_state !== 'unverified') {
    throw new ReflexionError(
      'NOT_REPRODUCED',
      `Only an unverified lesson can be promoted; ${lesson.lesson_id} is ${lesson.verification_state}.`,
    );
  }
  if (!evidence.regressionTestPassed) {
    throw new ReflexionError(
      'NOT_REPRODUCED',
      `The regression test did not pass, so ${lesson.lesson_id} stays unverified.`,
    );
  }
  if (!(lesson.regression_test ?? '').trim() || !evidence.command.trim()) {
    throw new ReflexionError('NOT_REPRODUCED', 'Promotion requires the regression test and command.');
  }

  return {
    ...lesson,
    verification_state: 'verified',
    verified_at: now().toISOString(),
    tags: [...new Set([...lesson.tags, 'verified'])],
  };
}

export async function recordReflexion(
  path: string,
  failure: FailureRecord,
  analysis: ReflexionAnalysis,
  options: { readonly now?: () => Date } = {},
): Promise<Lesson> {
  const lesson = draftReflexion(failure, analysis, options.now);
  await appendLesson(path, lesson);
  return lesson;
}
