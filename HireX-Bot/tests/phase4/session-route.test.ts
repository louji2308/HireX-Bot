import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from '@/app/api/onboarding/session/route';
import { MemoryIntakeStore } from '@/lib/onboarding/memory-store';
import { setIntakeStoreForTests } from '@/lib/onboarding/store';
import type { IntakeSession } from '@/types/phase4_contracts';

function request(
  method: string,
  options: { cookie?: string; body?: unknown; origin?: string } = {},
) {
  const headers = new Headers();
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.origin) headers.set('origin', options.origin);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest('http://localhost/api/onboarding/session', {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Expected a Set-Cookie header.');
  return setCookie.split(';', 1)[0] ?? '';
}

afterEach(() => {
  setIntakeStoreForTests(null);
});

describe('Phase 4 onboarding session route', () => {
  it('creates a draft, returns a cookie, and resumes it', async () => {
    const store = new MemoryIntakeStore();
    setIntakeStoreForTests(store);

    const created = await POST(request('POST'));
    expect(created.status).toBe(201);
    const cookie = cookieFrom(created);
    expect(cookie.startsWith('hirex_intake=')).toBe(true);

    const body = (await created.json()) as { session: IntakeSession };
    expect(body.session.mode).toBe('local_draft');
    expect(body.session.signals).toEqual({});

    const resumed = await GET(request('GET', { cookie }));
    expect(resumed.status).toBe(200);
    expect(((await resumed.json()) as { session: IntakeSession }).session.sessionId).toBe(
      body.session.sessionId,
    );
  });

  it('rejects cross-origin mutations', async () => {
    setIntakeStoreForTests(new MemoryIntakeStore());
    const response = await POST(request('POST', { origin: 'https://evil.example' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'ORIGIN_REJECTED' },
    });
  });

  it('updates the profile with an optimistic revision', async () => {
    const store = new MemoryIntakeStore();
    setIntakeStoreForTests(store);
    const created = await POST(request('POST'));
    const cookie = cookieFrom(created);
    const session = ((await created.json()) as { session: IntakeSession }).session;

    const patched = await PATCH(
      request('PATCH', {
        cookie,
        body: {
          expectedRevision: session.revision,
          profile: { collegeTier: 'Tier_2', preferredLanguage: 'hi' },
        },
      }),
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()) as { session: IntakeSession; status: string };
    expect(updated.status).toBe('applied');
    expect(updated.session.profile).toMatchObject({
      collegeTier: 'Tier_2',
      preferredLanguage: 'hi',
    });

    const stale = await PATCH(
      request('PATCH', {
        cookie,
        body: {
          expectedRevision: session.revision,
          profile: { collegeTier: 'Tier_3' },
        },
      }),
    );
    expect(stale.status).toBe(409);
  });

  it('erases the draft and clears the cookie', async () => {
    const store = new MemoryIntakeStore();
    setIntakeStoreForTests(store);
    const created = await POST(request('POST'));
    const cookie = cookieFrom(created);

    const deleted = await DELETE(request('DELETE', { cookie }));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({ erased: true, durable: false });
    expect(deleted.headers.get('set-cookie')).toContain('hirex_intake=');

    const resumed = await GET(request('GET', { cookie }));
    expect(await resumed.json()).toEqual({ session: null });
  });
});
