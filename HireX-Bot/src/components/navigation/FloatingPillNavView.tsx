import Link from 'next/link';

import { HollowIcon, type HollowIconName } from '@/components/ui/HollowIcon';
import { NAV_TABS, type NavTabId } from '@/types/phase3_contracts';

const TAB_ICONS: Record<NavTabId, HollowIconName> = {
  command: 'command',
  opportunities: 'opportunities',
  studio: 'studio',
  proof: 'proof',
  passport: 'passport',
};

export function FloatingPillNavView({
  activeTabId,
  className = '',
}: {
  readonly activeTabId: NavTabId | null;
  readonly className?: string;
}) {
  return (
    <nav
      aria-label="Primary"
      data-active-tab={activeTabId ?? 'none'}
      className={`fixed bottom-6 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-1 rounded-pill border border-hairline bg-surface p-1.5 shadow-navbar ${className}`}
    >
      {NAV_TABS.map((tab) => {
        const isActive = tab.id === activeTabId;

        if (isActive) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current="page"
              aria-label={tab.label}
              data-nav-tab={tab.id}
              data-active="true"
              className="flex h-11 items-center gap-2.5 rounded-pill bg-obsidian px-5 font-display text-sm font-normal tracking-[-0.01em] text-white transition-all duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-white"
            >
              <HollowIcon name={TAB_ICONS[tab.id]} size={18} strokeWidth={1.5} />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-label={tab.label}
            data-nav-tab={tab.id}
            data-active="false"
            className="group relative flex h-11 w-11 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-200 hover:bg-subtle hover:text-ink-primary"
          >
            <HollowIcon name={TAB_ICONS[tab.id]} size={20} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-compact border border-hairline bg-surface px-2 py-1 font-sans text-[11px] font-medium tracking-[0.03em] text-ink-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
