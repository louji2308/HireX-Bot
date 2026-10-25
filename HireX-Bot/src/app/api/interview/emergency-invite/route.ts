import type { NextRequest } from 'next/server';

import { jsonError, readJsonObject, sameOriginMutation } from '@/lib/onboarding/http';
import { createEmergencyOverride } from '@/inngest/workflows/emergency-invite-override';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Request body must be a JSON object.');

  const candidateId = typeof body.candidateId === 'string' ? body.candidateId : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const round = typeof body.round === 'string' ? body.round.trim() : '';
  const deadlineIso = typeof body.deadlineIso === 'string' ? body.deadlineIso : '';
  const now = typeof body.now === 'string' ? body.now : new Date().toISOString();

  if (!isUuid(candidateId)) return jsonError(400, 'INVALID_CANDIDATE', 'candidateId must be a UUID.');
  if (!company || !role || !round) return jsonError(400, 'INVALID_INPUT', 'company, role, and round are required.');
  if (Number.isNaN(Date.parse(deadlineIso))) return jsonError(400, 'INVALID_DEADLINE', 'deadlineIso must be an ISO timestamp.');

  const state = createEmergencyOverride({
    candidateId,
    company,
    role,
    round,
    deadlineIso,
    now,
  });

  return Response.json({ ...state, durable: false, source: 'local_emergency_override' });
}
