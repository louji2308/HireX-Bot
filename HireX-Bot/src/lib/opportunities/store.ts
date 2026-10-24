import { FileOpportunityStore } from '@/lib/opportunities/file-store';
import type { OpportunityStore } from '@/types/phase5_contracts';

let store: OpportunityStore | null = null;

export function getOpportunityStore(): OpportunityStore {
  store ??= new FileOpportunityStore();
  return store;
}

export function setOpportunityStoreForTests(next: OpportunityStore | null): void {
  store = next;
}

export async function eraseOpportunityWorkspace(sessionId: string): Promise<boolean> {
  try {
    return await getOpportunityStore().erase(sessionId);
  } catch {
    return false;
  }
}
