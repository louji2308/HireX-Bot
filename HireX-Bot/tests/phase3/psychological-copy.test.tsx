import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkspacePage } from '@/components/workspace/WorkspacePage';
import {
  COPY_GUARDRAIL_FORBIDDEN_TERMS,
  WORKSPACE_COPY,
  findForbiddenCopyTerms,
} from '@/lib/ux/copy';
import { NAV_TAB_IDS } from '@/types/phase3_contracts';

describe('candidate-facing copy guardrail', () => {
  it('covers every workspace tab with calm, non-deficit copy', () => {
    expect(Object.keys(WORKSPACE_COPY).sort()).toEqual([...NAV_TAB_IDS].sort());

    for (const tab of NAV_TAB_IDS) {
      const copy = WORKSPACE_COPY[tab];
      const combined = [copy.title, copy.description, copy.sectionLabel, ...copy.items, copy.closing].join('\n');

      expect(findForbiddenCopyTerms(combined), `${tab} contains a deficit term`).toEqual([]);
      expect(combined.toLowerCase()).not.toContain('guarantee');
      expect(combined.toLowerCase()).not.toContain('phase ');
    }
  });

  it('keeps rendered workspace pages free of deficit language', () => {
    for (const tab of NAV_TAB_IDS) {
      const html = renderToStaticMarkup(<WorkspacePage tab={tab} />);
      const text = html.replace(/<[^>]+>/g, ' ');
      expect(findForbiddenCopyTerms(text), `${tab} rendered copy`).toEqual([]);
      expect(text.toLowerCase()).not.toContain('guarantee');
    }
  });

  it('detects each forbidden term case-insensitively', () => {
    for (const term of COPY_GUARDRAIL_FORBIDDEN_TERMS) {
      expect(findForbiddenCopyTerms(term.toUpperCase())).toContain(term);
    }
    expect(findForbiddenCopyTerms('You are a strong candidate with next steps.')).toEqual([]);
  });

  it('does not claim any capability is live', () => {
    for (const tab of NAV_TAB_IDS.filter((candidate) => candidate !== 'command')) {
      expect(WORKSPACE_COPY[tab].closing.toLowerCase()).toContain('not connected');
    }
    expect(WORKSPACE_COPY.command.closing.toLowerCase()).toContain('no workflow activity yet');
  });
});
