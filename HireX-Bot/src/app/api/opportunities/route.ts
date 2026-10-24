import type { NextRequest } from 'next/server';

import { intakeSessionId, jsonError, sameOriginMutation } from '@/lib/onboarding/http';
import { getIntakeStore } from '@/lib/onboarding/store';
import { loadOpportunitySnapshots } from '@/lib/opportunities/snapshot-source';
import { getOpportunityStore } from '@/lib/opportunities/store';
import { sampleCandidate } from '@/agents/module4-discovery/candidate';
import { discoverOpportunities, toBoardResponse } from '@/agents/module4-discovery/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function previewBoard() {
  const snapshots = await loadOpportunitySnapshots();
  const workspace = discoverOpportunities({
    snapshots,
    candidate: sampleCandidate(),
    sessionId: 'preview',
    candidateId: 'sample_candidate',
    source: 'snapshot_preview',
    sampleCandidate: true,
  });
  return toBoardResponse(workspace);
}

export async function GET(request: NextRequest) {
  const sessionId = intakeSessionId(request);
  if (sessionId) {
    const workspace = await getOpportunityStore().read(sessionId);
    if (workspace) return Response.json(toBoardResponse(workspace));

    const intake = await getIntakeStore().read(sessionId);
    if (intake?.completion) {
      return jsonError(404, 'NO_WORKSPACE', 'Discover opportunities from the local intake first.');
    }
  }

  try {
    return Response.json(await previewBoard());
  } catch (error) {
    console.error(
      'Opportunity snapshot preview failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonError(500, 'SNAPSHOTS_UNAVAILABLE', 'Captured opportunity snapshots are unavailable.');
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }
  const sessionId = intakeSessionId(request);
  const erased = sessionId ? await getOpportunityStore().erase(sessionId) : false;
  return Response.json({
    erased,
    source: 'local_opportunity_store',
    durable: false,
    note: 'This removes the local opportunity workspace only.',
  });
}
