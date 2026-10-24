import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import { GET, DELETE } from '@/app/api/opportunities/route';
import { POST as DISCOVER } from '@/app/api/opportunities/discover/route';
import { POST as SAVE } from '@/app/api/opportunities/[pipelineId]/save/route';
import { DELETE as DELETE_INTAKE } from '@/app/api/onboarding/session/route';
import { MemoryIntakeStore } from '@/lib/onboarding/memory-store';
import { setIntakeStoreForTests } from '@/lib/onboarding/store';
import { setOpportunityStoreForTests } from '@/lib/opportunities/store';
import type { OpportunityBoardResponse } from '@/types/phase5_contracts';

import {
  MemoryOpportunityStore,
  completedDiscoverySession,
} from './fixtures';

async function seededIntake(): Promise<{ store: MemoryIntakeStore; cookie: string }> {
  const store = new MemoryIntakeStore();
  const completed = completedDiscoverySession();
  const base = await store.create({
    candidateId: completed.candidateId,
    createdAt: completed.createdAt,
  });
  const seeded = { ...completed, sessionId: base.sessionId };
  const result = await store.update(base.sessionId, base.revision, () => seeded);
  if (result.status !== 'applied') throw new Error('Could not seed intake.');
  return { store, cookie: `hirex_intake=${base.sessionId}` };
}

function request(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; origin?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.origin) headers.set('origin', options.origin);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function pipelineContext(pipelineId: string) {
  return { params: Promise.resolve({ pipelineId }) };
}

afterEach(() => {
  setIntakeStoreForTests(null);
  setOpportunityStoreForTests(null);
});

describe('Phase 5 opportunity routes', () => {
  it('returns a clearly labelled sample preview without a session', async () => {
    const response = await GET(request('/api/opportunities'));
    expect(response.status).toBe(200);
    const board = (await response.json()) as OpportunityBoardResponse;
    expect(board.synthetic_candidate).toBe(true);
    expect(board.source).toBe('snapshot_preview');
    expect(board.live).toBe(false);
    expect(board.durable).toBe(false);
    expect(board.counts).toEqual({ State_1: 0, State_2: 2, State_3: 1, State_4: 4 });
  });

  it('requires discovery before a session workspace exists', async () => {
    const { store, cookie } = await seededIntake();
    setIntakeStoreForTests(store);
    const opportunityStore = new MemoryOpportunityStore();
    setOpportunityStoreForTests(opportunityStore);
    const sessionId = cookie.slice('hirex_intake='.length);

    const missing = await GET(request('/api/opportunities', { cookie }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'NO_WORKSPACE' } });

    const discovered = await DISCOVER(request('/api/opportunities/discover', { method: 'POST', cookie }));
    expect(discovered.status).toBe(201);
    const board = (await discovered.json()) as OpportunityBoardResponse;
    expect(board.synthetic_candidate).toBe(false);
    expect(board.source).toBe('local_intake');
    expect(board.jobs).toHaveLength(7);
    expect(board.counts.State_1).toBe(0);
    expect(
      board.counts.State_1 +
        board.counts.State_2 +
        board.counts.State_3 +
        board.counts.State_4,
    ).toBe(7);

    expect(await opportunityStore.read(sessionId)).not.toBeNull();
    expect((await GET(request('/api/opportunities', { cookie }))).status).toBe(200);
  });

  it('toggles saved state and rejects cross-origin mutations', async () => {
    const { store, cookie } = await seededIntake();
    setIntakeStoreForTests(store);
    setOpportunityStoreForTests(new MemoryOpportunityStore());
    const discovered = await DISCOVER(request('/api/opportunities/discover', { method: 'POST', cookie }));
    const board = (await discovered.json()) as OpportunityBoardResponse;
    const first = board.jobs[0]!;

    const saved = await SAVE(
      request(`/api/opportunities/${first.pipeline_id}/save`, {
        method: 'POST',
        cookie,
        body: { saved: true },
      }),
      pipelineContext(first.pipeline_id),
    );
    expect(saved.status).toBe(200);
    const savedBoard = (await saved.json()) as OpportunityBoardResponse;
    expect(savedBoard.jobs.find((job) => job.pipeline_id === first.pipeline_id)?.saved).toBe(true);

    const rejected = await SAVE(
      request(`/api/opportunities/${first.pipeline_id}/save`, {
        method: 'POST',
        cookie,
        origin: 'https://evil.example',
        body: { saved: false },
      }),
      pipelineContext(first.pipeline_id),
    );
    expect(rejected.status).toBe(403);

    const mismatched = await SAVE(
      request(`/api/opportunities/${first.pipeline_id}/save`, {
        method: 'POST',
        cookie,
        body: { pipelineId: 'pipe_0000000000000000', saved: false },
      }),
      pipelineContext(first.pipeline_id),
    );
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({ error: { code: 'PIPELINE_MISMATCH' } });
  });

  it('erases the opportunity workspace when the intake is deleted', async () => {
    const { store, cookie } = await seededIntake();
    setIntakeStoreForTests(store);
    const opportunityStore = new MemoryOpportunityStore();
    setOpportunityStoreForTests(opportunityStore);
    await DISCOVER(request('/api/opportunities/discover', { method: 'POST', cookie }));
    const sessionId = cookie.slice('hirex_intake='.length);

    const deleted = await DELETE_INTAKE(
      request('/api/onboarding/session', { method: 'DELETE', cookie }),
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      erased: true,
      opportunitiesErased: true,
    });
    expect(await opportunityStore.read(sessionId)).toBeNull();
  });

  it('rejects an opportunity delete from another origin', async () => {
    const response = await DELETE(
      request('/api/opportunities', {
        method: 'DELETE',
        origin: 'https://evil.example',
      }),
    );
    expect(response.status).toBe(403);
  });
});
