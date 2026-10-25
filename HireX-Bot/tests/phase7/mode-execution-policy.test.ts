
import { describe, expect, it } from 'vitest';

import { MODE_EXECUTION_POLICIES } from '@/types/phase7_contracts';

describe('Phase 7 mode execution policy', () => {
  it('enables hints and vernacular only in Mode A', () => {
    expect(MODE_EXECUTION_POLICIES.Mode_A.hints_allowed).toBe(true);
    expect(MODE_EXECUTION_POLICIES.Mode_A.vernacular_allowed).toBe(true);
    expect(MODE_EXECUTION_POLICIES.Mode_B.hints_allowed).toBe(false);
    expect(MODE_EXECUTION_POLICIES.Mode_C.hints_allowed).toBe(false);
  });

  it('requires replay and proctoring only in Mode C', () => {
    expect(MODE_EXECUTION_POLICIES.Mode_C.proctored).toBe(true);
    expect(MODE_EXECUTION_POLICIES.Mode_C.replay_required).toBe(true);
    expect(MODE_EXECUTION_POLICIES.Mode_A.replay_required).toBe(false);
  });
});
