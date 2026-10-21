/**
 * Runtime composition of the swarm's memory surfaces.
 *
 * The Build Plan requires lessons to be in the system prompt and the episodic
 * store to be selected once at startup. Both are wired here so a running
 * process (the health route, and later the swarm workers) uses the same
 * instances instead of each caller re-reading the ledger.
 */

import { loadLessonAwarePromptRegistry } from '@/agents/prompts/memory-registry';
import {
  selectEpisodicStore,
  type EpisodicStore,
  type EpisodicStoreKind,
} from '@/lib/swarm/store-factory';
import { verifySkillArtifacts, voyagerSkillRegistry } from '@/lib/voyager-skills/registry';
import type { PromptRegistry } from '@/types/phase1_contracts';
import { existsSync } from 'node:fs';

export interface InjectedLessonSummary {
  readonly lessonId: string;
  readonly preventionRule: string;
  readonly confidence: number;
}

export interface SwarmRuntime {
  readonly promptRegistry: PromptRegistry;
  readonly injectedLessons: readonly InjectedLessonSummary[];
  /** Non-null when the lesson ledger exists but could not be read. */
  readonly memoryDegradedReason: string | null;
  readonly store: EpisodicStore;
  readonly storeKind: EpisodicStoreKind;
  readonly storeDetail: string;
  readonly skills: readonly string[];
  readonly skillArtifactProblems: readonly string[];
}

export interface GetSwarmRuntimeOptions {
  readonly lessonsPath?: string;
  readonly episodicPath?: string;
}

async function buildRuntime(options: GetSwarmRuntimeOptions): Promise<SwarmRuntime> {
  const lessonRegistry = await loadLessonAwarePromptRegistry(
    options.lessonsPath ? { path: options.lessonsPath } : {},
  );

  const selection = selectEpisodicStore({
    ...(options.episodicPath ? { path: options.episodicPath } : {}),
    fetchImpl: (url, init) => fetch(url, init),
  });

  const skillArtifactProblems = verifySkillArtifacts(voyagerSkillRegistry.list(), existsSync);

  return {
    promptRegistry: lessonRegistry.registry,
    injectedLessons: lessonRegistry.injected.map((lesson) => ({
      lessonId: lesson.lesson_id,
      preventionRule: lesson.prevention_rule,
      confidence: lesson.confidence,
    })),
    memoryDegradedReason: lessonRegistry.degradedReason,
    store: selection.store,
    storeKind: selection.kind,
    storeDetail: selection.detail,
    skills: voyagerSkillRegistry.list().map((skill) => skill.id),
    skillArtifactProblems,
  };
}

let cached: Promise<SwarmRuntime> | null = null;

export function getSwarmRuntime(options: GetSwarmRuntimeOptions = {}): Promise<SwarmRuntime> {
  cached ??= buildRuntime(options);
  return cached;
}

export function resetSwarmRuntimeForTests(): void {
  cached = null;
}
