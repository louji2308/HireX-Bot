import { describe, expect, it } from 'vitest';

import type { PistonRunResult, PistonTestCase } from '@/types/phase6_contracts';
import { verifyStage5Piston } from '@/agents/module5-blueprint/piston-qc';

const hiddenTests: readonly PistonTestCase[] = [
  { id: 'null', input: 'null', expected: '0', hidden: true },
  { id: 'one', input: '1', expected: '1', hidden: true },
  { id: 'negative', input: '-1', expected: '-1', hidden: true },
  { id: 'large', input: '100000', expected: '100000', hidden: true },
  { id: 'zero', input: '0', expected: '0', hidden: true },
];

function piston(results: readonly PistonRunResult[]) {
  let index = 0;
  return {
    execute: async () => {
      const result = results[index] ?? results[results.length - 1]!;
      index += 1;
      return result;
    },
  };
}

describe('Phase 6 QC Stage 5 Piston verification', () => {
  it('releases a valid reference solution that passes all hidden tests', async () => {
    const passed: PistonRunResult = {
      outcome: 'pass',
      exit_code: 0,
      stdout: '0\n1\n-1\n100000\n0\n',
      stderr: '',
      latency_ms: 42,
      memory_bytes: 1024,
      tests_passed: 5,
      tests_total: 5,
    };
    const failed: PistonRunResult = {
      outcome: 'fail',
      exit_code: 1,
      stdout: '',
      stderr: 'assertion failed',
      latency_ms: 10,
      memory_bytes: 1024,
      tests_passed: 0,
      tests_total: 5,
    };
    const result = await verifyStage5Piston({
      language: 'python',
      referenceSolution: 'def solve(value): return value',
      hiddenTests,
      mutatedBaseline: 'def solve(value): return value + 1',
      piston: piston([passed, failed]),
    });
    expect(result.passed).toBe(true);
    expect(result.reference_run.outcome).toBe('pass');
    expect(result.reference_run.tests_passed).toBe(5);
    expect(result.mutated_run.outcome).toBe('fail');
  });

  it('rejects a reference solution that times out at 3500ms', async () => {
    const timedOut: PistonRunResult = {
      outcome: 'time_limit_exceeded',
      exit_code: null,
      stdout: '',
      stderr: 'timeout',
      latency_ms: 3500,
      memory_bytes: null,
      tests_passed: 0,
      tests_total: 5,
    };
    const failed: PistonRunResult = {
      outcome: 'fail',
      exit_code: 1,
      stdout: '',
      stderr: 'assertion failed',
      latency_ms: 10,
      memory_bytes: 1024,
      tests_passed: 0,
      tests_total: 5,
    };
    const result = await verifyStage5Piston({
      language: 'python',
      referenceSolution: 'def solve(value): while True: pass',
      hiddenTests,
      mutatedBaseline: 'def solve(value): return value + 1',
      piston: piston([timedOut, failed]),
    });
    expect(result.passed).toBe(false);
    expect(result.rejection_reason).toContain('timeout');
  });

  it('rejects a weak test suite that fails to catch a mutated baseline', async () => {
    const passed: PistonRunResult = {
      outcome: 'pass',
      exit_code: 0,
      stdout: 'ok',
      stderr: '',
      latency_ms: 10,
      memory_bytes: 1024,
      tests_passed: 5,
      tests_total: 5,
    };
    const result = await verifyStage5Piston({
      language: 'python',
      referenceSolution: 'def solve(value): return value',
      hiddenTests,
      mutatedBaseline: 'def solve(value): return value + 1',
      piston: piston([passed, passed]),
    });
    expect(result.passed).toBe(false);
    expect(result.rejection_reason).toContain('weak');
  });
});
