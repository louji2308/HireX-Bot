/**
 * Chooses the episodic memory backend once, at startup.
 *
 * AGENTS.md §12.4 forbids adding a dependency without making its cost visible.
 * The rule here is simple: Qdrant only when `QDRANT_URL` is set; otherwise the
 * append-only JSONL ledger. The selection carries a human-readable `detail` so
 * the progress ledger and the runtime can state which store is actually in use.
 */

import { DEFAULT_QDRANT_COLLECTION, QdrantEpisodicFailureStore, type QdrantFetch } from './qdrant-store';
import type { FailureMemory, RankedMemory } from './episodic-store';
import { JsonlEpisodicFailureStore } from './episodic-store';

export const DEFAULT_EPISODIC_PATH = 'swarm/memory/failure_memories.jsonl';

export interface EpisodicStore {
  add(memory: FailureMemory): Promise<void>;
  search(query: string, k?: number): Promise<readonly RankedMemory[]>;
  size(): Promise<number>;
}

export type EpisodicStoreKind = 'jsonl' | 'qdrant';

export interface EpisodicStoreSelection {
  readonly store: EpisodicStore;
  readonly kind: EpisodicStoreKind;
  readonly detail: string;
}

export interface SelectEpisodicStoreOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly path?: string;
  readonly fetchImpl?: QdrantFetch;
}

export function selectEpisodicStore(options: SelectEpisodicStoreOptions = {}): EpisodicStoreSelection {
  const env = options.env ?? process.env;
  const url = env.QDRANT_URL?.trim();
  const collection = env.QDRANT_COLLECTION?.trim() || DEFAULT_QDRANT_COLLECTION;
  const path = options.path ?? env.FAILURE_MEMORY_PATH?.trim() ?? DEFAULT_EPISODIC_PATH;

  if (url) {
    if (!options.fetchImpl) {
      throw new Error(
        'QDRANT_URL is set but no fetch implementation was supplied; the store cannot be constructed implicitly.',
      );
    }
    return {
      store: new QdrantEpisodicFailureStore({
        url,
        fetchImpl: options.fetchImpl,
        ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
        collection,
      }),
      kind: 'qdrant',
      detail: `Qdrant collection "${collection}" at ${url}.`,
    };
  }

  return {
    store: new JsonlEpisodicFailureStore(path),
    kind: 'jsonl',
    detail: `Append-only JSONL ledger at ${path} (QDRANT_URL is not set).`,
  };
}
