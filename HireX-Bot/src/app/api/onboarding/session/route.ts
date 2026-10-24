import { NextResponse, type NextRequest } from 'next/server';

import {
  clearIntakeCookie,
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
  setIntakeCookie,
} from '@/lib/onboarding/http';
import {
  reviewExtraction,
  updateWorkspaceProfile,
  type ExtractionReviewPatch,
} from '@/lib/onboarding/intake-machine';
import { getIntakeStore } from '@/lib/onboarding/store';
import { eraseOpportunityWorkspace } from '@/lib/opportunities/store';
import { sessionView } from '@/lib/onboarding/view';
import type { IntakeSession } from '@/types/phase4_contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionId = intakeSessionId(request);
  if (!sessionId) return Response.json({ session: null });

  const session = await getIntakeStore().read(sessionId);
  if (!session) return Response.json({ session: null });
  return Response.json(sessionView(session));
}

export async function POST(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const store = getIntakeStore();
  const existingId = intakeSessionId(request);
  const existing = existingId ? await store.read(existingId) : null;
  if (existing) {
    return Response.json(sessionView(existing));
  }

  const session = await store.create();
  const response = NextResponse.json(sessionView(session), { status: 201 });
  setIntakeCookie(response, session.sessionId);
  return response;
}

export async function PATCH(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Send a JSON object.');

  const sessionId = intakeSessionId(request);
  if (!sessionId) return jsonError(401, 'NO_SESSION', 'Start an intake session first.');

  const expectedRevision = body.expectedRevision;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    return jsonError(400, 'INVALID_REVISION', 'expectedRevision is required.');
  }

  const store = getIntakeStore();
  const current = await store.read(sessionId);
  if (!current) return jsonError(404, 'NO_SESSION', 'This local draft no longer exists.');
  if (current.revision !== expectedRevision) {
    return Response.json({ status: 'conflict', session: current }, { status: 409 });
  }

  const now = new Date().toISOString();
  let next = current;

  if (body.review && typeof body.review === 'object' && !Array.isArray(body.review)) {
    const review = body.review as ExtractionReviewPatch;
    const result = reviewExtraction(next, review, now, next.revision);
    if (result.status === 'rejected') {
      return jsonError(400, result.code ?? 'INVALID_EXTRACTION', 'Review the extraction again.');
    }
    if (result.session) next = result.session;
  }

  if (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)) {
    const profile = body.profile as {
      collegeTier?: IntakeSession['profile']['collegeTier'];
      preferredLanguage?: IntakeSession['profile']['preferredLanguage'];
      autonomyLevel?: IntakeSession['profile']['autonomyLevel'];
    };
    const result = updateWorkspaceProfile(next, profile, now, next.revision);
    if (result.status === 'rejected') {
      return jsonError(400, result.code ?? 'INVALID_VALUE', 'Check the profile values.');
    }
    if (result.session) next = result.session;
  }

  if (next.revision === current.revision) {
    return Response.json({ status: 'duplicate', session: current });
  }

  const stored = await store.update(sessionId, current.revision, () => next);
  if (stored.status !== 'applied' || !stored.session) {
    return Response.json(stored, { status: stored.status === 'conflict' ? 409 : 404 });
  }

  return Response.json({ status: 'applied', ...sessionView(stored.session) });
}

export async function DELETE(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const sessionId = intakeSessionId(request);
  const erased = sessionId ? await getIntakeStore().erase(sessionId) : false;
  const opportunitiesErased = sessionId ? await eraseOpportunityWorkspace(sessionId) : false;

  const response = NextResponse.json({
    erased,
    opportunitiesErased,
    source: 'local_intake_store',
    durable: false,
    note: 'This removes the local onboarding draft and opportunity workspace. It does not delete records held by a connected Supabase project.',
  });
  clearIntakeCookie(response);
  return response;
}
