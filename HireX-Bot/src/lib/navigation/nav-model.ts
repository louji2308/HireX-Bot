import {
  NAV_TABS,
  type NavResolution,
  type NavTabId,
} from '@/types/phase3_contracts';

const WORKSPACE_ROOTS = new Set([
  'dashboard',
  'opportunities',
  'interview',
  'proof',
  'passport-vault',
  'governance',
]);

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function isHiddenPath(path: string): boolean {
  if (path === '/' || path === '/login' || path === '/tpo-console') {
    return true;
  }

  if (path.startsWith('/onboarding/') || path === '/onboarding') {
    return true;
  }

  if (path === '/passport' || path.startsWith('/passport/')) {
    return true;
  }

  if (path.startsWith('/tpo-console/')) {
    return true;
  }

  const root = path.split('/')[1] ?? '';
  return !WORKSPACE_ROOTS.has(root);
}

function activeTabForPath(path: string): NavTabId | null {
  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return 'command';
  }

  if (path === '/opportunities' || path.startsWith('/opportunities/')) {
    return 'opportunities';
  }

  if (path === '/interview' || path.startsWith('/interview/')) {
    return 'studio';
  }

  if (path === '/proof' || path.startsWith('/proof/')) {
    return 'proof';
  }

  if (
    path === '/passport-vault' ||
    path.startsWith('/passport-vault/') ||
    path === '/governance' ||
    path.startsWith('/governance/')
  ) {
    return 'passport';
  }

  return null;
}

export function resolveWorkspaceChrome(pathname: string): NavResolution {
  const normalizedPath = normalizePathname(pathname);

  if (isHiddenPath(normalizedPath)) {
    return {
      chrome: 'hidden',
      activeTabId: null,
      normalizedPath,
      isSessionRoute: false,
    };
  }

  const isSessionRoute =
    normalizedPath.startsWith('/interview/') && normalizedPath.length > '/interview/'.length;

  return {
    chrome: isSessionRoute ? 'focus' : 'workspace',
    activeTabId: activeTabForPath(normalizedPath),
    normalizedPath,
    isSessionRoute,
  };
}

export function getNavTab(tabId: NavTabId) {
  return NAV_TABS.find((tab) => tab.id === tabId) ?? null;
}
