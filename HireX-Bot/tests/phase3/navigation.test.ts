import { describe, expect, it } from 'vitest';

import { resolveWorkspaceChrome } from '@/lib/navigation/nav-model';
import { NAV_TABS } from '@/types/phase3_contracts';

describe('workspace navigation model', () => {
  it('keeps five ordered tabs mapped to the intended modules', () => {
    expect(NAV_TABS.map((tab) => tab.id)).toEqual([
      'command',
      'opportunities',
      'studio',
      'proof',
      'passport',
    ]);
    expect(NAV_TABS.map((tab) => tab.href)).toEqual([
      '/dashboard',
      '/opportunities',
      '/interview',
      '/proof',
      '/passport-vault',
    ]);
  });

  it('resolves the active tab for top-level and nested workspace routes', () => {
    expect(resolveWorkspaceChrome('/dashboard')).toMatchObject({
      chrome: 'workspace',
      activeTabId: 'command',
      isSessionRoute: false,
    });
    expect(resolveWorkspaceChrome('/opportunities/role-1/')).toMatchObject({
      chrome: 'workspace',
      activeTabId: 'opportunities',
      normalizedPath: '/opportunities/role-1',
    });
    expect(resolveWorkspaceChrome('/proof/sprints').activeTabId).toBe('proof');
    expect(resolveWorkspaceChrome('/governance').activeTabId).toBe('passport');
    expect(resolveWorkspaceChrome('/passport-vault').activeTabId).toBe('passport');
  });

  it('uses focus mode for a session route and keeps Studio active', () => {
    expect(resolveWorkspaceChrome('/interview/session-1')).toMatchObject({
      chrome: 'focus',
      activeTabId: 'studio',
      isSessionRoute: true,
    });
    expect(resolveWorkspaceChrome('/interview')).toMatchObject({
      chrome: 'workspace',
      activeTabId: 'studio',
      isSessionRoute: false,
    });
  });

  it('hides chrome on public, TPO and unknown routes', () => {
    for (const path of [
      '/',
      '/login',
      '/onboarding',
      '/onboarding/step-2',
      '/passport/abc123',
      '/tpo-console',
      '/tpo-console/cohort',
      '/unknown-route',
    ]) {
      expect(resolveWorkspaceChrome(path)).toMatchObject({
        chrome: 'hidden',
        activeTabId: null,
      });
    }
  });

  it('normalizes query strings, hashes and trailing slashes without misclassifying routes', () => {
    expect(resolveWorkspaceChrome('/dashboard?tab=next')).toMatchObject({
      chrome: 'workspace',
      activeTabId: 'command',
      normalizedPath: '/dashboard',
    });
    expect(resolveWorkspaceChrome('/proof#sprint-1').normalizedPath).toBe('/proof');
    expect(resolveWorkspaceChrome('/').normalizedPath).toBe('/');
  });
});
