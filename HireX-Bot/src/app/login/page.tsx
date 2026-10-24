import Link from 'next/link';
import { cookies } from 'next/headers';

import { StartIntakeButton } from '@/components/onboarding/StartIntakeButton';
import { getIntakeStore } from '@/lib/onboarding/store';
import {
  INTAKE_COOKIE_NAME,
  isIntakeSessionId,
} from '@/lib/onboarding/session-cookie';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const value = cookieStore.get(INTAKE_COOKIE_NAME)?.value;
  const sessionId = isIntakeSessionId(value) ? value : null;
  const draft = sessionId ? await getIntakeStore().read(sessionId) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 md:px-10">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg tracking-[-0.02em] text-ink-primary">HireX Bot</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Module 1 · Intake
        </span>
      </header>

      <section className="grid gap-12 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Proof before promises
          </p>
          <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.6rem,6vw,4.8rem)] font-normal leading-[0.98] tracking-[-0.045em] text-ink-primary">
            Start with what is actually true about your work.
          </h1>
          <p className="mt-7 max-w-xl text-[15px] leading-7 text-ink-secondary">
            Intake asks one question at a time, shows what was extracted from your resume, and
            lets you correct it. You can leave at any point and return to the same local draft.
          </p>
          <div className="mt-9 max-w-sm">
            <StartIntakeButton hasDraft={Boolean(draft)} />
          </div>
          <p className="mt-6 max-w-md text-xs leading-6 text-ink-muted">
            No account connection or employer integration is active in this build. The draft is
            stored on this server, not in a connected Supabase project.
          </p>
        </div>

        <aside className="border-t border-hairline pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            What this build can do
          </p>
          <ul className="mt-5 grid gap-4 text-sm leading-6 text-ink-secondary">
            <li className="border-b border-hairline pb-4">
              Extract facts from pasted text, with a source and confidence for each field.
            </li>
            <li className="border-b border-hairline pb-4">
              Record 34 signals across seven short chapters, without a long form.
            </li>
            <li className="border-b border-hairline pb-4">
              Run a five-minute practice probe. It is a baseline, not an employer assessment.
            </li>
            <li>
              Validate the onboarding event payload and show a local fan-out preview. Nothing is
              sent to an employer.
            </li>
          </ul>
          <Link
            href="/dashboard"
            className="mt-8 inline-block text-xs text-ink-muted underline decoration-hairline underline-offset-4 hover:text-ink-secondary"
          >
            Inspect the Phase 3 workspace shell
          </Link>
        </aside>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5 text-[10px] text-ink-muted">
        <span>Synthetic demo data must stay labelled.</span>
        <span>No application or message is submitted by this build.</span>
      </footer>
    </main>
  );
}
