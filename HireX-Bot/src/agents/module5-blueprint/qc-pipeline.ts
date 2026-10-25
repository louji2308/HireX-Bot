import type { BlueprintInputs } from '@/types/phase6_contracts';

export function bundleCacheKey(input: BlueprintInputs): string {
  return JSON.stringify(input);
}

export function resolvePreWarmedBundle<T>(cache: ReadonlyMap<string, T>, key: string): T | null {
  return cache.get(key) ?? null;
}
