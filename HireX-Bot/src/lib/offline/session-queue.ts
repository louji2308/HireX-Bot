import type { OfflineQueueEntry } from '@/types/phase7_contracts';

export interface OfflineQueue {
  readonly entries: readonly OfflineQueueEntry[];
}

export function createOfflineQueue(): OfflineQueue {
  return { entries: [] };
}

export function enqueueOfflineEvent(queue: OfflineQueue, entry: OfflineQueueEntry): OfflineQueue {
  if (queue.entries.some((item) => item.entry_id === entry.entry_id)) return queue;
  return { entries: [...queue.entries, entry] };
}

export async function drainOfflineQueue(
  queue: OfflineQueue,
  sync: (entries: readonly OfflineQueueEntry[]) => Promise<readonly string[]>,
): Promise<{ readonly queue: OfflineQueue; readonly applied: readonly string[] }> {
  const applied = await sync(queue.entries);
  const appliedSet = new Set(applied);
  return {
    queue: { entries: queue.entries.filter((entry) => !appliedSet.has(entry.entry_id)) },
    applied,
  };
}
