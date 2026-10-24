import type { NextRequest } from 'next/server';

import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
} from '@/lib/onboarding/http';
import { recordProbe } from '@/lib/onboarding/intake-machine';
import {
  createPracticeProbe,
  gradePracticeProbe,
  isProbeLanguage,
} from '@/lib/onboarding/probe';
import { getIntakeStore } from '@/lib/onboarding/store';
import { sessionView } from '@/lib/onboarding/view';
import type { ProbeLanguage } from '@/types/phase4_contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionId = intakeSessionId(request);
  if (!sessionId) return jsonError(401, 'NO_SESSION', 'Start an intake session first.');

  const session = await getIntakeStore().read(sessionId);
  if (!session) return jsonError(404, 'NO_SESSION', 'This local draft no longer exists.');

  const requested = request.nextUrl.searchParams.get('language');
  const language: ProbeLanguage = isProbeLanguage(requested) ? requested : 'typescript';
  const probe = createPracticeProbe(language);

  return Response.json({
    probe,
    revision: session.revision,
    verification: 'practice_baseline',
    semantic_evaluation: false,
  });
}

export async function POST(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Send a JSON object.');

  const expectedRevision = body.expectedRevision;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    return jsonError(400, 'INVALID_REVISION', 'expectedRevision is required.');
  }
  if (!isProbeLanguage(body.language)) {
    return jsonError(400, 'INVALID_LANGUAGE', 'Choose TypeScript, Python or Java.');
  }

  const skipped = body.skipped === true;
  const mcqChoice =
    typeof body.mcqChoice === 'string' && body.mcqChoice.length > 0 ? body.mcqChoice : null;
  const explanation = typeof body.explanation === 'string' ? body.explanation.slice(0, 2000) : '';

  if (!skipped && mcqChoice === null) {
    return jsonError(400, 'INVALID_ANSWER', 'Choose one option or skip the probe.');
  }

  const sessionId = intakeSessionId(request);
  if (!sessionId) return jsonError(401, 'NO_SESSION', 'Start an intake session first.');

  const store = getIntakeStore();
  const current = await store.read(sessionId);
  if (!current) return jsonError(404, 'NO_SESSION', 'This local draft no longer exists.');
  if (current.revision !== expectedRevision) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const result = gradePracticeProbe({
    language: body.language,
    mcqChoice,
    explanation,
    skipped,
  });
  const mutation = recordProbe(current, result, new Date().toISOString(), current.revision);
  if (mutation.status === 'rejected') {
    return jsonError(400, mutation.code ?? 'INVALID_VALUE', 'That probe result was not accepted.');
  }
  if (mutation.status !== 'applied' || !mutation.session) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const stored = await store.update(sessionId, current.revision, () => mutation.session!);
  if (stored.status !== 'applied' || !stored.session) {
    return Response.json(
      { status: 'conflict', session: stored.session ?? current },
      { status: 409 },
    );
  }

  return Response.json({
    status: 'applied',
    result,
    ...sessionView(stored.session),
  });
}
