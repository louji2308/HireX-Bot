import { NextResponse, type NextRequest } from 'next/server';

import {
  intakeSessionId,
  jsonError,
  readJsonObject,
  sameOriginMutation,
  setIntakeCookie,
} from '@/lib/onboarding/http';
import { extractResumeText } from '@/lib/onboarding/extraction';
import { applyExtraction } from '@/lib/onboarding/intake-machine';
import { getIntakeStore } from '@/lib/onboarding/store';
import { sessionView } from '@/lib/onboarding/view';
import { PHASE4_MAX_TEXT_CHARS } from '@/types/phase4_contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEXT_KINDS = new Set(['paste', 'txt', 'md']);
const UNSUPPORTED_BINARY_KINDS = new Set(['pdf', 'docx', 'doc']);

export async function POST(request: NextRequest) {
  if (!sameOriginMutation(request)) {
    return jsonError(403, 'ORIGIN_REJECTED', 'This request must come from the app origin.');
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError(400, 'INVALID_JSON', 'Send a JSON object.');

  const kind = typeof body.kind === 'string' ? body.kind.toLowerCase() : 'paste';
  if (UNSUPPORTED_BINARY_KINDS.has(kind)) {
    return jsonError(
      415,
      'SEMANTIC_EXTRACTION_UNAVAILABLE',
      'PDF/DOCX parsing is not connected in this build. Copy the resume text and paste it instead.',
    );
  }
  if (!TEXT_KINDS.has(kind)) {
    return jsonError(415, 'UNSUPPORTED_FILE', 'Use .txt, .md or paste the text.');
  }

  const text = typeof body.text === 'string' ? body.text : '';
  if (text.trim().length < 20) {
    return jsonError(400, 'TEXT_TOO_SHORT', 'Paste at least a few lines of resume text.');
  }
  if (text.length > PHASE4_MAX_TEXT_CHARS) {
    return jsonError(
      413,
      'TEXT_TOO_LARGE',
      `Paste at most ${String(PHASE4_MAX_TEXT_CHARS)} characters.`,
    );
  }

  const sourceName =
    typeof body.sourceName === 'string' && body.sourceName.trim().length > 0
      ? body.sourceName
      : null;

  const store = getIntakeStore();
  const existingId = intakeSessionId(request);
  const existing = existingId ? await store.read(existingId) : null;
  const session = existing ?? (await store.create());
  const created = existing === null;

  const extraction = extractResumeText({ text, sourceName });
  const mutation = applyExtraction(session, extraction, new Date().toISOString(), session.revision);
  if (mutation.status !== 'applied' || !mutation.session) {
    return jsonError(409, 'REVISION_CONFLICT', 'Reload the intake draft and try again.');
  }

  const stored = await store.update(session.sessionId, session.revision, () => mutation.session!);
  if (stored.status !== 'applied' || !stored.session) {
    return jsonError(409, 'REVISION_CONFLICT', 'Reload the intake draft and try again.');
  }

  const response = NextResponse.json({
    ...sessionView(stored.session),
    extraction,
    extraction_mode: 'deterministic_text',
    semantic_extraction: false,
  });
  if (created) setIntakeCookie(response, stored.session.sessionId);
  return response;
}
