import type { NextRequest } from 'next/server';

import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
} from '@/lib/onboarding/http';
import {
  acknowledgeNotice,
  updateWorkspaceProfile,
} from '@/lib/onboarding/intake-machine';
import { getIntakeStore } from '@/lib/onboarding/store';
import { sessionView } from '@/lib/onboarding/view';
import type {
  AutonomyLevel,
  CollegeTier,
  SupportedLanguage,
} from '@/types/phase4_contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
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

  const now = new Date().toISOString();
  let next = current;

  if (body.acknowledge === true) {
    const result = acknowledgeNotice(next, now, next.revision);
    if (result.status === 'rejected') {
      return jsonError(400, result.code ?? 'INVALID_VALUE', 'Check the notice values.');
    }
    if (result.session) next = result.session;
  }

  if (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)) {
    const profile = body.profile as {
      collegeTier?: CollegeTier | null;
      preferredLanguage?: SupportedLanguage;
      autonomyLevel?: AutonomyLevel;
    };
    const result = updateWorkspaceProfile(next, profile, now, next.revision);
    if (result.status === 'rejected') {
      return jsonError(400, result.code ?? 'INVALID_VALUE', 'Check the profile values.');
    }
    if (result.session) next = result.session;
  }

  if (next.revision === current.revision) {
    return Response.json({ status: 'duplicate', ...sessionView(current) });
  }

  const stored = await store.update(sessionId, current.revision, () => next);
  if (stored.status !== 'applied' || !stored.session) {
    return Response.json(
      { status: 'conflict', session: stored.session ?? current },
      { status: 409 },
    );
  }

  return Response.json({ status: 'applied', ...sessionView(stored.session) });
}
