import type { NextRequest } from 'next/server';

import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
} from '@/lib/onboarding/http';
import { getOpportunityStore } from '@/lib/opportunities/store';
import { toBoardResponse, withSavedState } from '@/agents/module4-discovery/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ pipelineId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const { pipelineId } = await context.params;
  if (!pipelineId.startsWith('pipe_') || pipelineId.length > 80) {
    return jsonError(400, 'INVALID_PIPELINE', 'A valid pipelineId path is required.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Send a JSON object.');
  if (typeof body.saved !== 'boolean') {
    return jsonError(400, 'INVALID_SAVED', 'saved must be a boolean.');
  }
  if ('pipelineId' in body && body.pipelineId !== pipelineId) {
    return jsonError(400, 'PIPELINE_MISMATCH', 'The body and path pipeline IDs must match.');
  }

  const sessionId = intakeSessionId(request);
  if (!sessionId) {
    return jsonError(401, 'NO_SESSION', 'Discover opportunities from a local intake first.');
  }

  const store = getOpportunityStore();
  const current = await store.read(sessionId);
  if (!current) {
    return jsonError(404, 'NO_WORKSPACE', 'No local opportunity workspace exists for this intake.');
  }

  const next = withSavedState(current, pipelineId, body.saved);
  if (!next) return jsonError(404, 'UNKNOWN_PIPELINE', 'That opportunity is not in this workspace.');
  if (next.revision === current.revision) return Response.json(toBoardResponse(current));

  const stored = await store.update(sessionId, current.revision, () => next);
  if (!stored) {
    return jsonError(409, 'REVISION_CONFLICT', 'The workspace changed. Reload before saving again.');
  }
  return Response.json(toBoardResponse(stored));
}
