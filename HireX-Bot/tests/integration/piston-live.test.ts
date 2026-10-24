/**
 * Live sandbox verification (AGENTS.md §12.5, §10.1 layer 5).
 *
 * A mocked executor is not proof of isolation, so this suite talks to a real
 * Piston instance and asserts that the limits are actually enforced. It is
 * opt-in because the default test gate must run without a running container:
 *
 *   $env:PISTON_LIVE='1'; npm test
 *   PISTON_BASE_URL=http://localhost:2000/api/v2   (optional, this is the default)
 *
 * Evidence captured 2026-10-21 against self-hosted Piston:
 *   python 3.10.0  print(6*7)       -> passed, stdout "42\n", cpu 54ms
 *   python 3.10.0  while True: pass -> time_limit_exceeded, SIGKILL at 3.1s
 *   python 3.10.0  bytearray(400MB) -> exit 137 at 134,216,000 bytes (128MiB cap)
 *   node 20.11.1   reduce(0..9)     -> passed, stdout "45\n", cpu 42ms
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  PistonClient,
  PISTON_LIMITS,
  type PistonFetch,
  type PistonFetchResponse,
} from '@/lib/piston/client';

const LIVE = process.env.PISTON_LIVE === '1';
const BASE_URL = process.env.PISTON_BASE_URL ?? 'http://localhost:2000/api/v2';

const liveFetch: PistonFetch = async (url, init) => {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body ? init.body : undefined,
    signal: init.signal,
  });
  return {
    status: response.status,
    ok: response.ok,
    text: () => response.text(),
    headers: { get: (name: string) => response.headers.get(name) },
  } satisfies PistonFetchResponse;
};

const client = () => new PistonClient({ fetchImpl: liveFetch, baseUrl: BASE_URL });

describe.skipIf(!LIVE)('Piston live sandbox', () => {
  /**
   * A WSL2 host wakes on demand and the Piston container needs a few seconds to
   * bind its port, so the first Windows request can be refused even though the
   * executor is healthy. Waiting here keeps the readiness race out of the
   * assertions without hiding a genuinely dead executor: if nothing answers
   * within 30s the suite fails.
   */
  beforeAll(async () => {
    const deadline = Date.now() + 30_000;
    let lastError = 'no attempt made';
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${BASE_URL}/runtimes`);
        if (response.ok) return;
        lastError = `status ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error(`Piston never became ready at ${BASE_URL}: ${lastError}`);
  }, 40_000);

  it('reports a reachable, authorized executor with an installed runtime', async () => {
    const capability = await client().probeCapability();

    expect(capability.runtimesReachable).toBe(true);
    expect(capability.executionAuthorized).toBe(true);
    expect(capability.verifiedLanguages).toContain('python');
    expect(capability.verifiedLanguages).toContain('javascript');
  }, 30_000);

  it('runs candidate code and returns the real stdout', async () => {
    const outcome = await client().execute({
      language: 'python',
      source: 'print(sum(range(10)))',
    });

    expect(outcome.kind).toBe('passed');
    if (outcome.kind === 'passed') {
      expect(outcome.stdout.trim()).toBe('45');
      expect(outcome.exitCode).toBe(0);
      expect(outcome.memoryBytes).toBeGreaterThan(0);
    }
  }, 30_000);

  it('runs JavaScript through the Node runtime', async () => {
    const outcome = await client().execute({
      language: 'javascript',
      source: 'console.log([...Array(10).keys()].reduce((a, b) => a + b, 0));',
    });

    expect(outcome.kind).toBe('passed');
    if (outcome.kind === 'passed') {
      expect(outcome.stdout.trim()).toBe('45');
      expect(outcome.version.startsWith('20.')).toBe(true);
    }
  }, 30_000);

  it('kills a runaway loop instead of hanging the request', async () => {
    const startedAt = Date.now();
    const outcome = await client().execute({
      language: 'python',
      source: 'while True:\n    pass\n',
    });
    const elapsedMs = Date.now() - startedAt;

    expect(outcome.kind).toBe('time_limit_exceeded');
    expect(elapsedMs).toBeLessThan(15_000);
  }, 30_000);

  it('enforces the memory limit and reports it as a limit kill, not a candidate bug', async () => {
    const outcome = await client().execute({
      language: 'python',
      source: 'a = bytearray(400 * 1024 * 1024)\nprint(len(a))\n',
    });

    expect(outcome.kind).toBe('memory_limit_exceeded');
    if (outcome.kind === 'memory_limit_exceeded') {
      expect(outcome.peakMemoryBytes).toBeGreaterThan(PISTON_LIMITS.runMemoryLimitBytes * 0.9);
    }
  }, 30_000);
});
