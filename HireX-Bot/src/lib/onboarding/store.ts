import { FileIntakeStore } from '@/lib/onboarding/file-store';
import type { IntakeStore } from '@/types/phase4_contracts';

let store: IntakeStore | null = null;

/**
 * Server-only default store. The file adapter is intentionally not durable for
 * serverless deployment; its `durable: false` flag must stay visible.
 */
export function getIntakeStore(): IntakeStore {
  store ??= new FileIntakeStore();
  return store;
}

export function setIntakeStoreForTests(next: IntakeStore | null): void {
  store = next;
}
