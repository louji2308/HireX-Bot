import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OrchestratorError,
  runDebate,
  type Critique,
  type DebateParticipant,
  type Proposal,
} from '@/lib/swarm/orchestrator';
import {
  ReflexionError,
  draftReflexion,
  promoteReflexion,
  recordReflexion,
  type FailureRecord,
  type ReflexionAnalysis,
} from '@/lib/swarm/reflexion';
import {
  TrajectoryRecordSchema,
  appendTrajectory,
  buildTrajectoryRecord,
  redactForTrajectory,
} from '@/lib/swarm/trajectory';
import { readLessons } from '@/lib/swarm/lessons';
import { createOllamaTransport, type OllamaFetch } from '@/lib/llm/ollama-transport';
import type { TransportRequest } from '@/types/phase1_contracts';

const question = {
  id: 'q-router-failover',
  question: 'How should the router fail over when the primary lab returns 429 mid-interview?',
  constraints: ['ADR-002', 'ROUTER_LIMITS.maxFailoverLatencyMs'],
};

const proposalFor = (role: string, overrides: Partial<Proposal> = {}): Proposal => ({
  role,
  decision: 'Fail over to the alternate cloud lab, never to local inference during Mode C.',
  rationale: 'Required evidence must come from a cloud lab.',
  evidence: ['ADR-002 Â§dual-lab'],
  alternatives: ['Queue the turn until the lab recovers.'],
  risks: ['Alternate lab latency exceeds the 250ms budget.'],
  confidence: 0.8,
  testableClaim: 'A 429 on the primary produces an attempt on the alternate within 250ms.',
  ...overrides,
});

const participant = (
  role: string,
  log: string[],
  overrides: Partial<Proposal> = {},
): DebateParticipant => ({
  role,
  label: role,
  async propose() {
    log.push(`${role}.propose`);
    return proposalFor(role, overrides);
  },
  async critique({ proposals }): Promise<readonly Critique[]> {
    log.push(`${role}.critique:${proposals.length}`);
    return [
      {
        role,
        targetRole: proposals[0]?.role ?? role,
        objection: 'The failover budget is asserted, not measured.',
        severity: 'high',
      },
    ];
  },
});

describe('MoA debate orchestrator', () => {
  it('collects every independent proposal before any critique begins', async () => {
    const log: string[] = [];
    const result = await runDebate({
      phase: 1,
      question,
      participants: [participant('D1', log), participant('D2', log)],
      arbitrate: async ({ proposals, critiques }) => ({
        decision: proposals[0]?.decision ?? '',
        rationale: `Weighed ${proposals.length} proposals and ${critiques.length} critiques.`,
        rejected: [{ role: 'D2', reason: 'Failover budget unmeasured.' }],
        dissent: ['D2: a 250ms budget cannot be guaranteed under load.'],
      }),
      clock: { now: () => 1_000 },
    });

    expect(log.slice(0, 2)).toEqual(['D1.propose', 'D2.propose']);
    expect(log.slice(2, 4)).toEqual(['D1.critique:2', 'D2.critique:2']);
    expect(result.critiques).toHaveLength(2);
    expect(result.dissentPreserved).toBe(true);
    expect(result.durationMs).toBe(0);
  });

  it('rejects a proposal with no evidence instead of averaging it in', async () => {
    await expect(
      runDebate({
        phase: 1,
        question,
        participants: [participant('D1', [], { evidence: [] })],
        arbitrate: async () => ({ decision: 'x', rationale: 'y', rejected: [], dissent: [] }),
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });

  it('rejects a proposal with no alternative or no stated risk', async () => {
    for (const overrides of [{ alternatives: [] }, { risks: [] }] as Partial<Proposal>[]) {
      await expect(
        runDebate({
          phase: 1,
          question,
          participants: [participant('D1', [], overrides)],
          arbitrate: async () => ({ decision: 'x', rationale: 'y', rejected: [], dissent: [] }),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PROPOSAL' });
    }
  });

  it('refuses duplicate roles and misattributed proposals', async () => {
    await expect(
      runDebate({
        phase: 1,
        question,
        participants: [participant('D1', []), participant('D1', [])],
        arbitrate: async () => ({ decision: 'x', rationale: 'y', rejected: [], dissent: [] }),
      }),
    ).rejects.toMatchObject({ code: 'NO_PARTICIPANTS' });

    await expect(
      runDebate({
        phase: 1,
        question,
        participants: [{ ...participant('D1', []), propose: async () => proposalFor('D9') }],
        arbitrate: async () => ({ decision: 'x', rationale: 'y', rejected: [], dissent: [] }),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PROPOSAL' });
  });

  it('rejects a critique aimed at a role that did not participate', async () => {
    const rogue: DebateParticipant = {
      role: 'D1',
      label: 'D1',
      propose: async () => proposalFor('D1'),
      critique: async () => [{ role: 'D1', targetRole: 'ghost', objection: 'nope', severity: 'low' }],
    };

    await expect(
      runDebate({
        phase: 1,
        question,
        participants: [rogue],
        arbitrate: async () => ({ decision: 'x', rationale: 'y', rejected: [], dissent: [] }),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PROPOSAL' });
  });

  it('fails loudly when the arbiter returns no decision', async () => {
    await expect(
      runDebate({
        phase: 1,
        question,
        participants: [participant('D1', [])],
        arbitrate: async () => ({ decision: ' ', rationale: 'y', rejected: [], dissent: [] }),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PROPOSAL' });
  });
});

const failure: FailureRecord = {
  phase: 1,
  module: 'lib/piston',
  taskId: 'T-1.4',
  test: 'tests/phase1/piston-client.test.ts > reports a memory kill',
  errorMessage: 'expected kind "memory_limit_exceeded" but received "runtime_error" (code 137)',
  filePaths: ['src/lib/piston/client.ts'],
  runId: 'run-42',
};

const analysis: ReflexionAnalysis = {
  rootCause: 'Exit code 137 was treated as a generic runtime error before the memory bound was checked.',
  preventionRule: 'Check the memory limit before classifying exit code 137 as a candidate error.',
  regressionTest: 'tests/phase1/piston-client.test.ts',
  confidence: 0.9,
};

describe('Reflexion agent', () => {
  it('drafts an unverified lesson bound to the observed failure', () => {
    const lesson = draftReflexion(failure, analysis, () => new Date('2026-10-21T10:00:00.000Z'));

    expect(lesson.verification_state).toBe('unverified');
    expect(lesson.verified_at).toBeNull();
    expect(lesson.lesson_id).toMatch(/^L-[0-9A-F]{8}$/);
    expect(lesson.provenance.source).toBe('sandbox_failure');
    expect(lesson.provenance.evidence_ref).toBe(failure.test);
    expect(lesson.regression_test).toBe(analysis.regressionTest);
  });

  it('refuses to invent a root cause or a regression test', () => {
    expect(() => draftReflexion(failure, { ...analysis, rootCause: ' ' })).toThrow(ReflexionError);
    expect(() => draftReflexion(failure, { ...analysis, regressionTest: '' })).toThrow(
      ReflexionError,
    );
    expect(() => draftReflexion({ ...failure, errorMessage: '' }, analysis)).toThrow(
      ReflexionError,
    );
  });

  it('promotes only after the regression test actually passed', () => {
    const lesson = draftReflexion(failure, analysis);

    expect(() =>
      promoteReflexion(lesson, {
        regressionTestPassed: false,
        command: 'npx vitest run tests/phase1/piston-client.test.ts',
      }),
    ).toThrow(ReflexionError);

    const verified = promoteReflexion(
      lesson,
      {
        regressionTestPassed: true,
        command: 'npx vitest run tests/phase1/piston-client.test.ts',
      },
      () => new Date('2026-10-21T11:00:00.000Z'),
    );

    expect(verified.verification_state).toBe('verified');
    expect(verified.verified_at).toBe('2026-10-21T11:00:00.000Z');
    expect(() =>
      promoteReflexion(verified, { regressionTestPassed: true, command: 'again' }),
    ).toThrow(ReflexionError);
  });

  it('records into the ledger and lands as non-injectable until verified', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hirex-bot-reflexion-'));
    const path = join(dir, 'lessons.json');
    await writeFile(path, JSON.stringify({ schema_version: 1, updated_at: "2026-10-21T00:00:00.000Z", lessons: [] }), 'utf8');

    const recorded = await recordReflexion(path, failure, analysis);
    const ledger = await readLessons(path);

    expect(ledger.lessons.map((lesson) => lesson.lesson_id)).toContain(recorded.lesson_id);
    expect(ledger.lessons.find((lesson) => lesson.lesson_id === recorded.lesson_id)?.verification_state).toBe(
      'unverified',
    );
  });
});

describe('DPO trajectory log', () => {
  it('redacts credentials, tokens and personal identifiers before writing', () => {
    const result = redactForTrajectory(
      'trainer@example.com used sk-abcdefghijklmnopqrstuvwx and Bearer abcdefghijklmnop with +91 98765 43210',
    );

    expect(result.text).not.toContain('trainer@example.com');
    expect(result.text).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result.text).not.toContain('abcdefghijklmnop');
    expect(result.text).not.toContain('98765');
    expect(result.redactions).toBeGreaterThanOrEqual(4);
  });

  it('never marks a Phase 1 decision log as training eligible', () => {
    const record = buildTrajectoryRecord({
      phase: 1,
      topic: 't',
      chosen: 'c',
      rejected: 'r',
      rejectionReason: 'rr',
      evidence: 'e',
    });

    expect(record.training_eligible).toBe(false);
    expect(record.reason_not_eligible).toMatch(/No model training/);
    expect(TrajectoryRecordSchema.safeParse(record).success).toBe(true);
  });

  it('appends one valid, redacted JSON line per decision', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hirex-bot-dpo-'));
    const path = join(dir, 'phase_01_dpo.jsonl');

    await appendTrajectory(
      {
        phase: 1,
        topic: 'secret-handling',
        chosen: 'Redact before append.',
        rejected: 'Log the key sk-abcdefghijklmnopqrstuvwx directly.',
        rejectionReason: 'Credential leak.',
        evidence: 'AGENTS.md Â§14',
      },
      { path },
    );

    const raw = await readFile(path, 'utf8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(raw).not.toContain('sk-abcdefghijklmnopqrstuvwx');

    const parsed = TrajectoryRecordSchema.safeParse(JSON.parse(lines[0] ?? '{}'));
    expect(parsed.success).toBe(true);
  });

  it('derives a stable pair id for the same decision', () => {
    const draft = {
      phase: 1,
      topic: 't',
      chosen: 'c',
      rejected: 'r',
      rejectionReason: 'rr',
      evidence: 'e',
    };
    expect(buildTrajectoryRecord(draft).pair_id).toBe(buildTrajectoryRecord(draft).pair_id);
  });
});

const transportRequest = (overrides: Partial<TransportRequest> = {}): TransportRequest => ({
  requestId: 'req-1',
  modelId: 'qwen2.5-coder:7b',
  messages: [
    { role: 'system', content: 'You are a grader.' },
    { role: 'user', content: 'Grade this.' },
  ],
  responseFormat: 'json',
  temperature: 0,
  maxOutputTokens: 512,
  timeoutMs: 500,
  signal: new AbortController().signal,
  ...overrides,
});

describe('Ollama transport', () => {
  it('speaks /api/chat with json format and reports usage', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl: OllamaFetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { content: '{"score":4}' },
            prompt_eval_count: 12,
            eval_count: 5,
          }),
      };
    };

    const transport = createOllamaTransport({ fetchImpl });
    const response = await transport.complete(transportRequest());

    expect(calls[0]?.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(calls[0]?.body.stream).toBe(false);
    expect(calls[0]?.body.format).toBe('json');
    expect(response.status).toBe(200);
    expect(response.bodyText).toBe('{"score":4}');
    expect(response.usage).toEqual({ inputTokens: 12, outputTokens: 5, totalTokens: 17 });
  });

  it('passes through a rate-limit status with retry-after', async () => {
    const fetchImpl: OllamaFetch = async () => ({
      status: 429,
      headers: { get: (name: string) => (name === 'retry-after' ? '2' : null) },
      text: async () => 'slow down',
    });

    const response = await createOllamaTransport({ fetchImpl }).complete(transportRequest());

    expect(response.status).toBe(429);
    expect(response.retryAfterMs).toBe(2000);
  });

  it('treats an empty message or non-JSON body as an upstream failure, not an empty answer', async () => {
    const empty: OllamaFetch = async () => ({
      status: 200,
      text: async () => JSON.stringify({ message: { content: '' } }),
    });
    const html: OllamaFetch = async () => ({ status: 200, text: async () => '<html>' });

    expect((await createOllamaTransport({ fetchImpl: empty }).complete(transportRequest())).status).toBe(502);
    expect((await createOllamaTransport({ fetchImpl: html }).complete(transportRequest())).status).toBe(502);
  });

  it('enforces the per-request timeout', async () => {
    const fetchImpl: OllamaFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    await expect(
      createOllamaTransport({ fetchImpl }).complete(transportRequest({ timeoutMs: 20 })),
    ).rejects.toThrow(/aborted/);
  });
});
