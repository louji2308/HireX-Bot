import type { NextRequest, NextResponse } from 'next/server';

import {
  INTAKE_COOKIE_NAME,
  intakeCookieOptions,
  isIntakeSessionId,
} from '@/lib/onboarding/session-cookie';

export function intakeSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(INTAKE_COOKIE_NAME)?.value;
  return isIntakeSessionId(value) ? value : null;
}

export function setIntakeCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(INTAKE_COOKIE_NAME, sessionId, intakeCookieOptions());
}

export function clearIntakeCookie(response: NextResponse): void {
  response.cookies.set(INTAKE_COOKIE_NAME, '', {
    ...intakeCookieOptions(),
    maxAge: 0,
  });
}

export function sameOriginMutation(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return Response.json({ error: { code, message } }, { status }) as NextResponse;
}

export async function readJsonObject(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return null;

  try {
    const value: unknown = await request.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
