import { NextResponse } from 'next/server';
import { getSandboxCapability } from '@/lib/piston/service';
import { getSwarmRuntime } from '@/lib/swarm/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Read-only readiness surface. It reports what the process can actually do:
 * which languages passed a real probe, which memory store is in use and whether
 * the lesson ledger was readable. It deliberately exposes no execution endpoint:
 * running arbitrary code belongs behind authenticated Studio routes (Phase 7).
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  let sandbox:
    | {
        ok: boolean;
        verifiedLanguages: readonly string[];
        installedLanguages: readonly string[];
        executor: string | null;
        detail: string;
      }
    | { ok: false; detail: string };

  try {
    const capability = await getSandboxCapability();
    sandbox = {
      ok: capability.executionAuthorized,
      verifiedLanguages: capability.verifiedLanguages,
      installedLanguages: capability.installedLanguages,
      executor: capability.executor,
      detail: capability.detail,
    };
  } catch (error) {
    sandbox = {
      ok: false,
      detail: error instanceof Error ? error.message : 'sandbox configuration error',
    };
  }

  let memory:
    | {
        ok: boolean;
        storeKind: string;
        storeDetail: string;
        lessonsInjected: number;
        lessonIds: readonly string[];
        degradedReason: string | null;
        skills: readonly string[];
        skillArtifactProblems: readonly string[];
      }
    | { ok: false; detail: string };

  try {
    const swarm = await getSwarmRuntime();
    memory = {
      ok: swarm.memoryDegradedReason === null && swarm.skillArtifactProblems.length === 0,
      storeKind: swarm.storeKind,
      storeDetail: swarm.storeDetail,
      lessonsInjected: swarm.injectedLessons.length,
      lessonIds: swarm.injectedLessons.map((lesson) => lesson.lessonId),
      degradedReason: swarm.memoryDegradedReason,
      skills: swarm.skills,
      skillArtifactProblems: swarm.skillArtifactProblems,
    };
  } catch (error) {
    memory = {
      ok: false,
      detail: error instanceof Error ? error.message : 'swarm runtime error',
    };
  }

  const ok = sandbox.ok && memory.ok;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      checks: { sandbox, memory },
      elapsedMs: Date.now() - startedAt,
    },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
