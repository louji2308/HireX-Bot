'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FloatingPillNavView } from '@/components/navigation/FloatingPillNavView';
import { FocusStrip } from '@/components/navigation/FocusStrip';
import { JudgeXRayInspector } from '@/components/telemetry/JudgeXRayInspector';
import { resolveWorkspaceChrome } from '@/lib/navigation/nav-model';

export function WorkspaceChrome({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const resolution = resolveWorkspaceChrome(pathname);

  if (resolution.chrome === 'hidden') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-obsidian focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pt-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium tracking-[-0.01em] text-ink-primary"
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-obsidian" />
          HireX Bot
        </Link>

        <div
          role="group"
          aria-label="Workspace role (institutional sign-in is not enabled in this build)"
          title="Institutional sign-in is not enabled in this build."
          className="flex items-center rounded-pill border border-hairline bg-surface p-0.5"
        >
          <button
            type="button"
            disabled
            aria-pressed="true"
            className="cursor-not-allowed rounded-pill bg-obsidian px-3 py-1.5 text-[11px] text-white opacity-80"
          >
            Candidate
          </button>
          <button
            type="button"
            disabled
            aria-pressed="false"
            className="cursor-not-allowed rounded-pill px-3 py-1.5 text-[11px] text-ink-muted opacity-60"
          >
            Institution
          </button>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-6 pb-32 pt-12 outline-none md:pt-16"
      >
        {children}
      </main>

      <JudgeXRayInspector />
      {resolution.chrome === 'focus' ? (
        <FocusStrip />
      ) : (
        <FloatingPillNavView activeTabId={resolution.activeTabId} />
      )}
    </div>
  );
}
