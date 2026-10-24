import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/onboarding/complete/route';
import { MemoryIntakeStore } from '@/lib/onboarding/memory-store';
import { setIntakeStoreForTests } from '@/lib/onboarding/store';
import {
  CANDIDATE_ID,
  driveAnswers,
  withConsent,
  withWorkspaceProfile,
} from './fixtures';

function request(cookie: string, expectedRevision: number) {
  return new NextRequest('http://localhost/api/onboarding/complete', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expectedRevision }),
  });
}

afterEach(() => {
  setIntakeStoreForTests(null);
});

describe('Phase 4 completion route', () => {
  it('validates the frozen event but never claims delivery', async () => {
    const store = new MemoryIntakeStore();
    setIntakeStoreForTests(store);
    const created = await store.create({ candidateId: CANDIDATE_ID });
    const ready = withConsent(withWorkspaceProfile(driveAnswers(created)));
    const seeded = await store.update(created.sessionId, created.revision, () => ready);
    expect(seeded.status).toBe('applied');

    const response = await POST(request(`hirex_intake=${created.sessionId}`, ready.revision));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      event: { name: string; payload: Record<string, unknown> };
      delivery: { emitted: boolean; durable: boolean; source: string };
      completion: { payload: Record<string, unknown> };
    };
    expect(body.status).toBe('applied');
    expect(body.event.name).toBe('candidate/onboarding.completed');
    expect(body.event.payload).toEqual(body.completion.payload);
    expect(body.delivery).toMatchObject({
      emitted: false,
      durable: false,
      source: 'local_preview',
    });
  });

  it('rejects completion before required consent and signals are resolved', async () => {
    const store = new MemoryIntakeStore();
    setIntakeStoreForTests(store);
    const created = await store.create({ candidateId: CANDIDATE_ID });

    const response = await POST(request(`hirex_intake=${created.sessionId}`, created.revision));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INCOMPLETE');
  });
});
