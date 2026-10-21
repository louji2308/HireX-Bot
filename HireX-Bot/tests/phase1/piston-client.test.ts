import { describe, expect, it } from 'vitest';
import {
  PistonClient,
  PISTON_LIMITS,
  type PistonFetch,
  type PistonFetchResponse,
} from '@/lib/piston/client';

const response = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): PistonFetchResponse => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

const recorder = (impl: (url: string) => PistonFetchResponse) => {
  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: PistonFetch = async (url, init) => {
    calls.push({ url, body: init.body ?? '' });
    return impl(url);
  };
  return { calls, fetchImpl };
};

const passingRun = {
  language: 'python',
  version: '3.12.0',
  run: { stdout: '45\n', stderr: '', output: '45\n', code: 0, signal: null, status: null, cpu_time: 12, wall_time: 40, memory: 8_000_000 },
};

describe('PistonClient contract', () => {
  it('sends the mandated 3s CPU and 128MB memory limits', async () => {
    const { calls, fetchImpl } = recorder(() => response(200, passingRun));
    const client = new PistonClient({ fetchImpl });

    await client.execute({ language: 'python', source: 'print(sum(range(10)))' });

    const body = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(body.run_timeout).toBe(PISTON_LIMITS.runTimeoutMs);
    expect(body.run_cpu_time).toBe(PISTON_LIMITS.runCpuTimeMs);
    expect(body.run_memory_limit).toBe(PISTON_LIMITS.runMemoryLimitBytes);
    expect(PISTON_LIMITS.runCpuTimeMs).toBe(3000);
    expect(PISTON_LIMITS.runMemoryLimitBytes).toBe(134_217_728);
  });

  it('reports a clean run as passed with observed metrics', async () => {
    const { fetchImpl } = recorder(() => response(200, passingRun));
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('passed');
    if (outcome.kind === 'passed') {
      expect(outcome.stdout).toBe('45\n');
      expect(outcome.exitCode).toBe(0);
      expect(outcome.cpuTimeMs).toBe(12);
      expect(outcome.language).toBe('python');
      expect(outcome.version).toBe('3.12.0');
    }
  });

  it('reports an unauthenticated executor as unauthorized, never as passed', async () => {
    const { fetchImpl } = recorder(() => response(401, { message: 'authorization required' }));
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('unauthorized');
    expect(outcome.kind).not.toBe('passed');
  });

  it('reports rate limiting with the retry hint', async () => {
    const { fetchImpl } = recorder(() => response(429, { message: 'slow down' }, { 'retry-after': '2' }));
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('rate_limited');
    if (outcome.kind === 'rate_limited') expect(outcome.retryAfterMs).toBe(2_000);
  });

  it('separates compile errors from runtime errors', async () => {
    const compileClient = new PistonClient({
      fetchImpl: recorder(() =>
        response(200, {
          language: 'c++',
          version: '20.0.0',
          compile: { stdout: '', stderr: "error: 'main' was not declared", output: '', code: 1, signal: null },
          run: { stdout: '', stderr: '', output: '', code: 0, signal: null },
        }),
      ).fetchImpl,
    });
    expect((await compileClient.execute({ language: 'c++', source: 'int x;' })).kind).toBe(
      'compile_error',
    );

    const runtimeClient = new PistonClient({
      fetchImpl: recorder(() =>
        response(200, {
          language: 'python',
          version: '3.12.0',
          run: { stdout: '', stderr: 'ZeroDivisionError', output: 'ZeroDivisionError', code: 1, signal: null },
        }),
      ).fetchImpl,
    });
    expect((await runtimeClient.execute({ language: 'python', source: '1/0' })).kind).toBe(
      'runtime_error',
    );
  });

  it('reports a CPU-limit kill as time_limit_exceeded', async () => {
    const { fetchImpl } = recorder(() =>
      response(200, {
        language: 'python',
        version: '3.12.0',
        run: { stdout: '', stderr: '', output: '', code: null, signal: 'SIGKILL', status: 'TO' },
      }),
    );
    const client = new PistonClient({ fetchImpl });

    expect((await client.execute({ language: 'python', source: 'while True: pass' })).kind).toBe(
      'time_limit_exceeded',
    );
  });

  it('marks truncated output as inconclusive rather than passing', async () => {
    const { fetchImpl } = recorder(() =>
      response(200, {
        language: 'python',
        version: '3.12.0',
        run: { stdout: 'x'.repeat(1024), stderr: '', output: '', code: 0, signal: null, status: 'OL' },
      }),
    );
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'print("x"*5000)' });
    expect(outcome.kind).toBe('output_limit_exceeded');
  });

  it('reports an unknown runtime as unsupported rather than retrying', async () => {
    const { fetchImpl } = recorder(() => response(400, { message: 'html-5.0.0 runtime is unknown' }));
    const client = new PistonClient({ fetchImpl });

    expect((await client.execute({ language: 'html', source: '<p>x</p>' })).kind).toBe(
      'unsupported_language',
    );
  });

  it('reports a network failure as infra error, never as a candidate failure', async () => {
    const client = new PistonClient({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND emkc.org');
      },
    });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });
    expect(outcome.kind).toBe('infra_error');
  });

  it('rejects oversized source locally without calling the executor', async () => {
    const { calls, fetchImpl } = recorder(() => response(200, passingRun));
    const client = new PistonClient({ fetchImpl, maxSourceBytes: 64 });

    const outcome = await client.execute({ language: 'python', source: 'x'.repeat(65) });

    expect(outcome.kind).toBe('invalid_request');
    expect(calls).toHaveLength(0);
  });

  it('never reports passed on a malformed body', async () => {
    const { fetchImpl } = recorder(() => response(200, 'not-json'));
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });
    expect(outcome.kind).toBe('infra_error');
  });

  it('reports a cgroup memory kill as a limit kill, not a candidate bug', async () => {
    const { fetchImpl } = recorder(() =>
      response(200, {
        language: 'python',
        version: '3.10.0',
        run: {
          stdout: '',
          stderr: 'Killed',
          output: 'Killed',
          code: 137,
          signal: null,
          status: 'RE',
          memory: 134_216_000,
        },
      }),
    );
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({
      language: 'python',
      source: 'a = bytearray(400 * 1024 * 1024)',
    });

    expect(outcome.kind).toBe('memory_limit_exceeded');
    if (outcome.kind === 'memory_limit_exceeded') {
      expect(outcome.peakMemoryBytes).toBe(134_216_000);
    }
  });

  it('treats a SIGKILL far below the memory limit as an unattributed kill, not a timeout', async () => {
    const { fetchImpl } = recorder(() =>
      response(200, {
        language: 'python',
        version: '3.10.0',
        run: { stdout: '', stderr: '', output: '', code: 137, signal: null, memory: 8_000_000 },
      }),
    );
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({ language: 'python', source: 'import os; os.kill(os.getpid(), 9)' });
    expect(outcome.kind).toBe('killed');
    if (outcome.kind === 'killed') {
      expect(outcome.message).toMatch(/did not report a limit/i);
    }
  });

  it('classifies a memory kill as memory_limit_exceeded even when the executor also reports TO', async () => {
    const { fetchImpl } = recorder(() =>
      response(200, {
        language: 'python',
        version: '3.10.0',
        run: {
          stdout: '',
          stderr: '',
          output: '',
          code: 137,
          signal: 'SIGKILL',
          status: 'TO',
          memory: 134_216_000,
        },
      }),
    );
    const client = new PistonClient({ fetchImpl });

    const outcome = await client.execute({
      language: 'python',
      source: 'a = bytearray(400 * 1024 * 1024)',
    });

    expect(outcome.kind).toBe('memory_limit_exceeded');
  });

  it('forwards caller-specified limits instead of silently using the defaults', async () => {
    const { calls, fetchImpl } = recorder(() => response(200, passingRun));
    const client = new PistonClient({ fetchImpl });

    await client.execute({
      language: 'python',
      source: 'print(1)',
      memoryLimitBytes: 64 * 1024 * 1024,
      cpuTimeMs: 1_500,
      runTimeoutMs: 2_000,
    });

    const body = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(body.run_memory_limit).toBe(67_108_864);
    expect(body.run_cpu_time).toBe(1_500);
    expect(body.run_timeout).toBe(2_000);
  });

  it('reports a reachable executor with no installed runtime as not authorized', async () => {
    const fetchImpl: PistonFetch = async () => response(200, []);
    const client = new PistonClient({ fetchImpl });

    const capability = await client.probeCapability();

    expect(capability.runtimesReachable).toBe(true);
    expect(capability.executionAuthorized).toBe(false);
    expect(capability.verifiedLanguages).toEqual([]);
    expect(capability.detail).toMatch(/no language runtime/i);
  });

  it('probes capability honestly: runtimes may be public while execute is not', async () => {
    const fetchImpl: PistonFetch = async (url) =>
      url.endsWith('/runtimes')
        ? response(200, [{ language: 'python', version: '3.12.0', aliases: ['py'] }])
        : response(401, { message: 'authorization required' });
    const client = new PistonClient({ fetchImpl });

    const capability = await client.probeCapability();

    expect(capability.runtimesReachable).toBe(true);
    expect(capability.executionAuthorized).toBe(false);
    expect(capability.verifiedLanguages).toEqual([]);
    expect(capability.installedLanguages).toContain('python');
    expect(capability.detail).toMatch(/authoriz/i);
  });

  it('verifies each listed language by execution instead of trusting the catalogue', async () => {
    const fetchImpl: PistonFetch = async (url, init) => {
      if (url.endsWith('/runtimes')) {
        return response(200, [
          { language: 'python', version: '3.10.0' },
          { language: 'javascript', version: '20.11.1' },
          { language: 'brainfuck', version: '2.7.3' },
        ]);
      }
      const body = JSON.parse(init.body ?? '') as { language: string };
      if (body.language === 'javascript') {
        return response(200, {
          language: 'javascript',
          version: '20.11.1',
          run: { stdout: '', stderr: 'boom', output: 'boom', code: 1, signal: null },
        });
      }
      return response(200, passingRun);
    };
    const client = new PistonClient({ fetchImpl });

    const capability = await client.probeCapability();

    expect(capability.executionAuthorized).toBe(true);
    expect(capability.verifiedLanguages).toEqual(['python']);
    expect(capability.installedLanguages).toEqual(['python', 'javascript', 'brainfuck']);
    expect(capability.detail).toMatch(/javascript/);
    expect(capability.detail).toMatch(/brainfuck/);
  });

  it('probes fallback endpoints so a healthy secondary is reported as available', async () => {
    const seen: string[] = [];
    const fetchImpl: PistonFetch = async (url) => {
      seen.push(url);
      if (url.startsWith('http://primary.invalid')) throw new Error('ECONNREFUSED');
      return url.endsWith('/runtimes')
        ? response(200, [{ language: 'python', version: '3.10.0' }])
        : response(200, passingRun);
    };
    const client = new PistonClient({
      fetchImpl,
      baseUrl: 'http://primary.invalid/api/v2',
      fallbackBaseUrls: ['http://secondary.test/api/v2'],
    });

    const capability = await client.probeCapability();

    expect(capability.executionAuthorized).toBe(true);
    expect(capability.executor).toBe('secondary.test/api/v2');
    expect(seen.some((url) => url.startsWith('http://primary.invalid'))).toBe(true);
  });
});

describe('PistonClient transport hygiene', () => {
  it('sends no body with GET requests', async () => {
    const methods: Array<{ method: string; body: string | undefined }> = [];
    const fetchImpl: PistonFetch = async (url, init) => {
      methods.push({ method: init.method, body: init.body });
      return url.endsWith('/runtimes')
        ? response(200, [{ language: 'python', version: '3.10.0' }])
        : response(200, passingRun);
    };
    const client = new PistonClient({ fetchImpl });

    await client.probeCapability();

    const getCalls = methods.filter((call) => call.method === 'GET');
    expect(getCalls.length).toBeGreaterThan(0);
    expect(getCalls.every((call) => call.body === undefined)).toBe(true);
  });
});

describe('PistonClient endpoint failover', () => {
  it('uses the secondary executor when the primary refuses connections', async () => {
    const calls: string[] = [];
    const fetchImpl: PistonFetch = async (url) => {
      calls.push(url);
      if (url.includes('primary.invalid')) throw new Error('ECONNREFUSED');
      return response(200, passingRun);
    };
    const client = new PistonClient({
      fetchImpl,
      baseUrl: 'http://primary.invalid/api/v2',
      fallbackBaseUrls: ['http://secondary.invalid/api/v2'],
    });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('passed');
    expect(calls[0]).toContain('primary.invalid');
    expect(calls[1]).toContain('secondary.invalid');
  });

  it('fails over on a 5xx from the primary', async () => {
    const { calls, fetchImpl } = recorder((url) =>
      url.includes('primary') ? response(503, 'unavailable') : response(200, passingRun),
    );
    const client = new PistonClient({
      fetchImpl,
      baseUrl: 'http://primary.test/api/v2',
      fallbackBaseUrls: ['http://secondary.test/api/v2'],
    });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('passed');
    expect(calls).toHaveLength(2);
  });

  it('does not fail over a request the executor rejected for a real reason', async () => {
    const { calls, fetchImpl } = recorder(() => response(400, { message: 'runtime is unknown' }));
    const client = new PistonClient({
      fetchImpl,
      baseUrl: 'http://primary.test/api/v2',
      fallbackBaseUrls: ['http://secondary.test/api/v2'],
    });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('unsupported_language');
    expect(calls).toHaveLength(1);
  });

  it('reports infra_error only after every endpoint failed', async () => {
    const calls: string[] = [];
    const fetchImpl: PistonFetch = async (url) => {
      calls.push(url);
      throw new Error('ECONNREFUSED');
    };
    const client = new PistonClient({
      fetchImpl,
      baseUrl: 'http://primary.test/api/v2',
      fallbackBaseUrls: ['http://secondary.test/api/v2', 'http://primary.test/api/v2/'],
    });

    const outcome = await client.execute({ language: 'python', source: 'print(1)' });

    expect(outcome.kind).toBe('infra_error');
    expect(calls).toHaveLength(2);
  });
});
describe('PistonClient language mapping', () => {
  it('gives TypeScript and SQL their real file extensions', async () => {
    for (const [language, name] of [
      ['typescript', 'main.ts'],
      ['javascript', 'main.js'],
      ['sql', 'main.sql'],
      ['python', 'main.py'],
    ] as const) {
      const { calls, fetchImpl } = recorder(() => response(200, passingRun));
      await new PistonClient({ fetchImpl }).execute({ language, source: 'x' });
      const body = JSON.parse(calls[0]?.body ?? '{}') as { files: Array<{ name: string }> };
      expect(body.files[0]?.name).toBe(name);
    }
  });
});