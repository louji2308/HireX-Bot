import type { NextRequest } from 'next/server';

import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
} from '@/lib/onboarding/http';
import { applyAnswer, skipSignal } from '@/lib/onboarding/intake-machine';
import { getIntakeStore } from '@/lib/onboarding/store';
import { sessionView } from '@/lib/onboarding/view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Send a JSON object.');

  const signalId = body.signalId;
  if (!Number.isInteger(signalId)) {
    return jsonError(400, 'INVALID_SIGNAL', 'signalId must be an integer.');
  }
  const expectedRevision = body.expectedRevision;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    return jsonError(400, 'INVALID_REVISION', 'expectedRevision is required.');
  }

  const sessionId = intakeSessionId(request);
  if (!sessionId) return jsonError(401, 'NO_SESSION', 'Start an intake session first.');

  const store = getIntakeStore();
  const current = await store.read(sessionId);
  if (!current) return jsonError(404, 'NO_SESSION', 'This local draft no longer exists.');
  if (current.revision !== expectedRevision) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const now = new Date().toISOString();
  const mutation =
    body.skip === true
      ? skipSignal(current, signalId as number, now, current.revision)
      : applyAnswer(current, signalId as number, body.value, now, current.revision);

  if (mutation.status === 'duplicate') {
    return Response.json({ status: 'duplicate', ...sessionView(current) });
  }
  if (mutation.status === 'rejected') {
    return jsonError(400, mutation.code ?? 'INVALID_VALUE', 'That answer was not accepted.');
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

  return Response.json({ status: 'applied', ...sessionView(stored.session) });
}
