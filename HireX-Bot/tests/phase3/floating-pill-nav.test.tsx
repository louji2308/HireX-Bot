import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FloatingPillNavView } from '@/components/navigation/FloatingPillNavView';
import { FocusStrip } from '@/components/navigation/FocusStrip';
import { NAV_TABS } from '@/types/phase3_contracts';

describe('floating pill navigation', () => {
  it('renders five destination links with a single active pill', () => {
    const html = renderToStaticMarkup(<FloatingPillNavView activeTabId="command" />);

    expect(html.match(/data-nav-tab=/g)).toHaveLength(NAV_TABS.length);
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/passport-vault"');
    expect(html).toContain('data-active-tab="command"');
    expect(html).toContain('bg-obsidian');
    expect(html).toContain('Command');
  });

  it('labels every inactive icon-only tab for assistive technology', () => {
    const html = renderToStaticMarkup(<FloatingPillNavView activeTabId="proof" />);

    for (const tab of NAV_TABS.filter((candidate) => candidate.id !== 'proof')) {
      expect(html).toContain(`aria-label="${tab.label}"`);
    }
    expect(html.match(/data-active="false"/g)).toHaveLength(4);
  });

  it('renders a real focus strip instead of the five-tab pill in a session', () => {
    const html = renderToStaticMarkup(<FocusStrip />);

    expect(html).toContain('data-focus-strip="true"');
    expect(html).toContain('Exit focus');
    expect(html).toContain('href="/interview"');
    expect(html).not.toContain('data-nav-tab');
  });
});
