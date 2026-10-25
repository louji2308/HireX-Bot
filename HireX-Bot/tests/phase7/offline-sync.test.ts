import { describe, expect, it } from 'vitest';

import type { OfflineQueueEntry } from '@/types/phase7_contracts';
import { createOfflineQueue, enqueueOfflineEvent } from '@/lib/offline/session-queue';
import { syncOfflineQueue } from '@/lib/offline/sync';

const entry: OfflineQueueEntry = {
  entry_id: 'entry-1',
  session_id: 'session-1',
  candidate_id: 'candidate-1',
  queued_at: '2026-10-25T12:00:00.000Z',
  payload_type: 'keystroke',
  payload: { delta: 'x' },
};

describe('Phase 7 offline sync', () => {
  it('reports synced when every queued entry is acknowledged', async () => {
    const queue = enqueueOfflineEvent(createOfflineQueue(), entry);
    const result = await syncOfflineQueue(queue, async () => ['entry-1']);
    expect(result.status).toBe('synced');
    expect(result.applied).toEqual(['entry-1']);
    expect(result.queue.entries).toHaveLength(0);
  });

  it('reports sync_failed when an entry is not acknowledged', async () => {
    const queue = enqueueOfflineEvent(createOfflineQueue(), entry);
    const result = await syncOfflineQueue(queue, async () => []);
    expect(result.status).toBe('sync_failed');
    expect(result.queue.entries).toHaveLength(1);
  });

  it('reports sync_failed when the sender throws', async () => {
    const queue = enqueueOfflineEvent(createOfflineQueue(), entry);
    const result = await syncOfflineQueue(queue, async () => { throw new Error('network'); });
    expect(result.status).toBe('sync_failed');
    expect(result.queue.entries).toHaveLength(1);
  });
});
