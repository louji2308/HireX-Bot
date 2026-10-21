/**
 * Server-side composition of the prompt registry with verified lessons.
 *
 * The Build Plan requires the top lessons to be in the system prompt without a
 * caller having to remember to inject them. This module is the single place
 * that reads `swarm/memory/lessons.json` and decorates `promptRegistry`.
 *
 * A missing ledger is normal on a fresh checkout and yields the base registry.
 * A corrupt ledger also yields the base registry, but the caller receives a
 * `degradedReason` so the condition is visible instead of silent.
 */

import { promptRegistry } from '@/agents/prompts';
import {
  selectLessonsForPrompt,
  withLessonMemory,
  type LessonInjectionOptions,
} from '@/agents/prompts/lessons-context';
import { readLessons, type Lesson } from '@/lib/swarm/lessons';
import type { PromptRegistry } from '@/types/phase1_contracts';

export const DEFAULT_LESSONS_PATH = 'swarm/memory/lessons.json';

export interface LessonAwarePromptRegistry {
  readonly registry: PromptRegistry;
  readonly injected: readonly Lesson[];
  readonly degradedReason: string | null;
}

export interface LoadLessonRegistryOptions extends LessonInjectionOptions {
  readonly path?: string;
  readonly base?: PromptRegistry;
}

export async function loadLessonAwarePromptRegistry(
  options: LoadLessonRegistryOptions = {},
): Promise<LessonAwarePromptRegistry> {
  const base = options.base ?? promptRegistry;

  try {
    const ledger = await readLessons(options.path ?? DEFAULT_LESSONS_PATH);
    const decoratorOptions: LessonInjectionOptions = {
      maxLessons: options.maxLessons,
      module: options.module,
      phase: options.phase,
    };
    const injected = [...selectLessonsForPrompt(ledger.lessons, decoratorOptions)];

    return {
      registry: withLessonMemory(base, ledger.lessons, decoratorOptions),
      injected,
      degradedReason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown lesson ledger error';
    return { registry: base, injected: [], degradedReason: message };
  }
}
