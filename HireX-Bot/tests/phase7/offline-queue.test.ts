import { describe, expect, it } from 'vitest';

import type { OfflineQueueEntry } from '@/types/phase7_contracts';
import { createOfflineQueue, drainOfflineQueue, enqueueOfflineEvent } from '@/lib/offline/session-queue';

const entry: OfflineQueueEntry = {
  entry_id: 'entry-1',
  session_id: 'session-1',
  candidate_id: 'candidate-1',
  queued_at: '2026-10-25T12:00:00.000Z',
  payload_type: 'keystroke',
  payload: { delta: 'x' },
};

describe('Phase 7 offline queue', () => {
  it('deduplicates entries by entry id', () => {
    const queue = enqueueOfflineEvent(enqueueOfflineEvent(createOfflineQueue(), entry), entry);
    expect(queue.entries).toHaveLength(1);
    expect(queue.entries[0]?.entry_id).toBe('entry-1');
  });

  it('drains acknowledged entries and reports applied ids', async () => {
    const queue = enqueueOfflineEvent(createOfflineQueue(), entry);
    const result = await drainOfflineQueue(queue, async () => ['entry-1']);
    expect(result.applied).toEqual(['entry-1']);
    expect(result.queue.entries).toHaveLength(0);
  });

  it('retains entries that are not acknowledged', async () => {
    const queue = enqueueOfflineEvent(createOfflineQueue(), entry);
    const result = await drainOfflineQueue(queue, async () => []);
    expect(result.applied).toEqual([]);
    expect(result.queue.entries).toHaveLength(1);
  });
});
