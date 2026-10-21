import { describe, expect, it, vi } from 'vitest';
import {
  SANDBOX_LANGUAGE_ALLOWLIST,
  SandboxConfigError,
  createSandboxService,
  resolveSandboxConfig,
} from '@/lib/piston/service';
import { SELF_HOSTED_BASE_URL, type PistonFetch } from '@/lib/piston/client';

const okRuntimes = (body: unknown) => ({
  status: 200,
  ok: true,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
});

const passingRun = {
  language: 'python',
  version: '3.10.0',
  run: { stdout: '45', stderr: '', output: '45', code: 0, signal: null, cpu_time: 5, wall_time: 8, memory: 1000 },
};

const catalogue: PistonFetch = async (url) =>
  url.endsWith('/runtimes')
    ? okRuntimes([{ language: 'python', version: '3.10.0' }])
    : okRuntimes(passingRun);

describe('sandbox configuration', () => {
  it('defaults to the self-hosted loopback executor, never the public host', () => {
    const config = resolveSandboxConfig({});

    expect(config.baseUrl).toBe(SELF_HOSTED_BASE_URL);
    expect(config.baseUrl.startsWith('http://127.0.0.1')).toBe(true);
    expect(config.fallbackBaseUrls).toEqual([]);
    expect(config.allowedLanguages).toEqual([...SANDBOX_LANGUAGE_ALLOWLIST]);
  });

  it('refuses a remote executor unless remote execution is explicitly enabled', () => {
    expect(() => resolveSandboxConfig({ PISTON_BASE_URL: 'https://emkc.org/api/v2/piston' })).toThrow(
      SandboxConfigError,
    );
  });

  it('accepts a remote executor when PISTON_ALLOW_REMOTE=1 is set explicitly', () => {
    const config = resolveSandboxConfig({
      PISTON_BASE_URL: 'https://emkc.org/api/v2/piston',
      PISTON_ALLOW_REMOTE: '1',
    });

    expect(config.baseUrl).toBe('https://emkc.org/api/v2/piston');
    expect(config.allowRemote).toBe(true);
  });

  it('drops a remote primary but keeps an explicitly configured loopback fallback', () => {
    const config = resolveSandboxConfig({
      PISTON_BASE_URL: 'https://sandbox.example.com/api/v2',
      PISTON_FALLBACK_BASE_URLS: 'http://localhost:2000/api/v2, http://10.0.0.5/api/v2',
    });

    expect(config.baseUrl).toBe('http://localhost:2000/api/v2');
    expect(config.rejectedRemoteEndpoints).toEqual([
      'https://sandbox.example.com/api/v2',
      'http://10.0.0.5/api/v2',
    ]);
  });

  it('honours a narrowed language allowlist', () => {
    const config = resolveSandboxConfig({ PISTON_ALLOWED_LANGUAGES: 'python' });
    expect(config.allowedLanguages).toEqual(['python']);
  });
});

describe('sandbox service', () => {
  it('rejects a language outside the allowlist without contacting the executor', async () => {
    const fetchImpl = vi.fn(catalogue);
    const service = createSandboxService({ env: {}, fetchImpl });

    const outcome = await service.execute({ language: 'java', source: 'class Main {}' });

    expect(outcome.kind).toBe('unsupported_language');
    if (outcome.kind === 'unsupported_language') {
      expect(outcome.message).toMatch(/not enabled/i);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('normalises the language and executes an allowed request', async () => {
    const service = createSandboxService({ env: {}, fetchImpl: catalogue });

    const outcome = await service.execute({ language: 'Python', source: 'print(45)' });

    expect(outcome.kind).toBe('passed');
    if (outcome.kind === 'passed') {
      expect(outcome.stdout).toBe('45');
    }
  });

  it('reports only languages that passed a real probe', async () => {
    const fetchImpl: PistonFetch = async (url, init) => {
      if (url.endsWith('/runtimes')) {
        return okRuntimes([
          { language: 'python', version: '3.10.0' },
          { language: 'javascript', version: '20.11.1' },
        ]);
      }
      const request = JSON.parse(init.body ?? '') as { language: string };
      const failed = request.language === 'python';
      return okRuntimes({
        language: request.language,
        version: '20.11.1',
        run: {
          stdout: failed ? '' : '45',
          stderr: failed ? 'ModuleNotFoundError' : '',
          output: failed ? 'ModuleNotFoundError' : '45',
          code: failed ? 1 : 0,
          signal: null,
        },
      });
    };
    const service = createSandboxService({ env: {}, fetchImpl });

    const capability = await service.capability();

    expect(capability.executionAuthorized).toBe(true);
    expect(capability.verifiedLanguages).toEqual(['javascript']);
    expect(capability.installedLanguages).toEqual(['python', 'javascript']);
  });
});
