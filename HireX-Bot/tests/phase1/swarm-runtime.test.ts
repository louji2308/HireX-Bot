import { afterEach, describe, expect, it } from 'vitest';
import { getSwarmRuntime, resetSwarmRuntimeForTests } from '@/lib/swarm/runtime';

afterEach(() => {
  resetSwarmRuntimeForTests();
  delete process.env.QDRANT_URL;
});

describe('swarm runtime composition', () => {
  it('injects verified lessons into the system prompt at startup', async () => {
    const runtime = await getSwarmRuntime();

    expect(runtime.injectedLessons.length).toBeGreaterThan(0);
    expect(runtime.injectedLessons.length).toBeLessThanOrEqual(3);
    expect(runtime.memoryDegradedReason).toBeNull();
    expect(runtime.promptRegistry.get('socratic.v1')?.system).toContain('verified prevention rules');
  });

  it('selects the JSONL episodic store when Qdrant is not configured', async () => {
    const runtime = await getSwarmRuntime();

    expect(runtime.storeKind).toBe('jsonl');
    expect(runtime.storeDetail).toMatch(/QDRANT_URL is not set/);
  });

  it('reports the promoted Voyager skills and their artifact state', async () => {
    const runtime = await getSwarmRuntime();

    expect(runtime.skills).toHaveLength(9);
    expect(runtime.skillArtifactProblems).toEqual([]);
  });

  it('degrades visibly instead of crashing when the lesson ledger cannot be read', async () => {
    const runtime = await getSwarmRuntime({ lessonsPath: 'swarm/memory/does-not-exist.json' });

    expect(runtime.injectedLessons).toEqual([]);
    expect(runtime.memoryDegradedReason).toBeNull();
    expect(runtime.promptRegistry.get('socratic.v1')?.system).not.toContain('verified prevention rules');
  });

  it('uses Qdrant when QDRANT_URL is configured', async () => {
    process.env.QDRANT_URL = 'http://127.0.0.1:6333';

    const runtime = await getSwarmRuntime();

    expect(runtime.storeKind).toBe('qdrant');
    expect(runtime.storeDetail).toContain('127.0.0.1:6333');
  });
});
