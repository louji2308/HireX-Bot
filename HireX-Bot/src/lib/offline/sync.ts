import { drainOfflineQueue, type OfflineQueue } from '@/lib/offline/session-queue';
import type { OfflineQueueEntry } from '@/types/phase7_contracts';

export type OfflineSyncStatus = 'synced' | 'sync_failed';

export interface OfflineSyncResult {
  readonly status: OfflineSyncStatus;
  readonly applied: readonly string[];
  readonly queue: OfflineQueue;
}

export async function syncOfflineQueue(
  queue: OfflineQueue,
  send: (entries: readonly OfflineQueueEntry[]) => Promise<readonly string[]>,
): Promise<OfflineSyncResult> {
  try {
    const result = await drainOfflineQueue(queue, send);
    return {
      status: result.applied.length === queue.entries.length ? 'synced' : 'sync_failed',
      applied: result.applied,
      queue: result.queue,
    };
  } catch {
    return { status: 'sync_failed', applied: [], queue };
  }
}
