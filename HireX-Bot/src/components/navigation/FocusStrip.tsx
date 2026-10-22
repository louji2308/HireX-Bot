import Link from 'next/link';

import { HollowIcon } from '@/components/ui/HollowIcon';

export function FocusStrip() {
  return (
    <div
      data-focus-strip="true"
      className="fixed bottom-4 left-1/2 z-40 flex h-9 -translate-x-1/2 items-center gap-3 rounded-pill border border-obsidian bg-obsidian px-3.5 text-white shadow-navbar"
    >
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">
        <HollowIcon name="studio" size={14} strokeWidth={1.5} />
        Focus mode
      </span>
      <Link
        href="/interview"
        className="rounded-pill border border-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white transition-colors hover:bg-white/10"
      >
        Exit focus
      </Link>
    </div>
  );
}
