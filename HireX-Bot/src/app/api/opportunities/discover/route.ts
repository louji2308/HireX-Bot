import type { NextRequest } from 'next/server';

import { intakeSessionId, jsonError, sameOriginMutation } from '@/lib/onboarding/http';
import { getIntakeStore } from '@/lib/onboarding/store';
import { loadOpportunitySnapshots } from '@/lib/opportunities/snapshot-source';
import { getOpportunityStore } from '@/lib/opportunities/store';
import {
  CandidateInputError,
  candidateFromIntake,
} from '@/agents/module4-discovery/candidate';
import { discoverOpportunities, toBoardResponse } from '@/agents/module4-discovery/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const sessionId = intakeSessionId(request);
  if (!sessionId) {
    return jsonError(401, 'NO_SESSION', 'Finish the local intake before discovering opportunities.');
  }

  const intake = await getIntakeStore().read(sessionId);
  if (!intake) {
    return jsonError(404, 'NO_SESSION', 'This local intake draft no longer exists.');
  }

  let candidate;
  try {
    candidate = candidateFromIntake(intake);
  } catch (error) {
    if (error instanceof CandidateInputError) {
      return jsonError(409, error.code, error.message);
    }
    throw error;
  }

  let snapshots;
  try {
    snapshots = await loadOpportunitySnapshots();
  } catch (error) {
    console.error(
      'Opportunity snapshot load failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonError(500, 'SNAPSHOTS_UNAVAILABLE', 'Captured opportunity snapshots are unavailable.');
  }

  const workspace = discoverOpportunities({
    snapshots,
    candidate,
    sessionId,
    candidateId: intake.candidateId,
    source: 'local_intake',
    sampleCandidate: false,
  });

  try {
    await getOpportunityStore().write(workspace);
  } catch (error) {
    console.error(
      'Opportunity workspace write failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonError(500, 'WORKSPACE_WRITE_FAILED', 'The local opportunity workspace could not be saved.');
  }

  return Response.json(toBoardResponse(workspace), { status: 201 });
}
