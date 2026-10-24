import type { NextRequest } from 'next/server';

import { candidateOnboardingCompletedSchema } from '@/inngest/events';
import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
} from '@/lib/onboarding/http';
import { completeIntake } from '@/lib/onboarding/intake-machine';
import { buildLocalFanOutPreview } from '@/lib/onboarding/local-fanout';
import { getIntakeStore } from '@/lib/onboarding/store';
import { sessionView } from '@/lib/onboarding/view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const sessionId = intakeSessionId(request);
  if (!sessionId) return jsonError(401, 'NO_SESSION', 'Start an intake session first.');

  const store = getIntakeStore();
  const current = await store.read(sessionId);
  if (!current) return jsonError(404, 'NO_SESSION', 'This local draft no longer exists.');
  if (current.revision !== expectedRevision) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const mutation = completeIntake(current, new Date().toISOString(), current.revision);
  if (mutation.status === 'duplicate') {
    return Response.json({ status: 'duplicate', ...sessionView(current) });
  }
  if (mutation.status === 'rejected') {
    return jsonError(
      400,
      mutation.code ?? 'INCOMPLETE',
      'Finish the required signals and consent before completing intake.',
    );
  }
  if (mutation.status !== 'applied' || !mutation.session?.completion) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const eventPayload = mutation.session.completion.payload;
  const eventCheck = candidateOnboardingCompletedSchema.safeParse(eventPayload);
  if (!eventCheck.success) {
    return jsonError(
      422,
      'EVENT_PAYLOAD_INVALID',
      'The completion payload did not match the frozen event schema.',
    );
  }

  const stored = await store.update(sessionId, current.revision, () => mutation.session!);
  if (stored.status !== 'applied' || !stored.session?.completion) {
    return Response.json(
      { status: 'conflict', session: stored.session ?? current },
      { status: 409 },
    );
  }

  return Response.json({
    status: 'applied',
    ...sessionView(stored.session),
    completion: stored.session.completion,
    fanOutPreview: buildLocalFanOutPreview(stored.session),
    event: {
      name: 'candidate/onboarding.completed',
      payload: eventCheck.data,
    },
    delivery: {
      emitted: false,
      durable: false,
      source: 'local_preview',
      reason:
        'Inngest is not connected to this build. The payload was validated against the frozen schema but not sent.',
    },
  });
}
