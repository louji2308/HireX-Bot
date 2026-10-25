import { describe, expect, it } from 'vitest';

import { SENIORITY_MAX_COMPLEXITY } from '@/types/phase6_contracts';
import { seniorityAllows } from '@/agents/module5-blueprint/blueprint-generator';

describe('Phase 6 seniority guardrails', () => {
  it('defines a complexity ceiling for every candidate level', () => {
    expect(SENIORITY_MAX_COMPLEXITY.Intern).toBe(1);
    expect(SENIORITY_MAX_COMPLEXITY.New_Grad_Fresher).toBe(2);
    expect(SENIORITY_MAX_COMPLEXITY.Entry_Level_0_2Y).toBe(3);
    expect(SENIORITY_MAX_COMPLEXITY.Mid_Level).toBe(4);
  });

  it('does not allow a new graduate above level 2 complexity', () => {
    expect(seniorityAllows('New_Grad_Fresher', 2)).toBe(true);
    expect(seniorityAllows('New_Grad_Fresher', 3)).toBe(false);
  });

  it('does not allow an intern above level 1 complexity', () => {
    expect(seniorityAllows('Intern', 1)).toBe(true);
    expect(seniorityAllows('Intern', 2)).toBe(false);
  });
});
