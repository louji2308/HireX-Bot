/**
 * Qdrant adapter for episodic failure memory (ADR-003 / Build Plan Step 1.4).
 *
 * The default development store is the JSONL ledger, because Qdrant Cloud needs
 * an account and a paid long-lived cluster while this build must stay at a
 * zero-dollar budget. This adapter therefore only runs when a Qdrant endpoint is
 * configured, and the store factory makes that choice explicit rather than
 * silently downgrading retrieval.
 *
 * Vectors come from the deterministic hashed embedding in `episodic-store.ts`,
 * so nothing about a candidate's failure is sent to a third-party embedding API.
 */

import { createHash } from 'node:crypto';
import {
  EMBEDDING_DIMENSIONS,
  FailureMemorySchema,
  embed,
  type FailureMemory,
  type RankedMemory,
} from '@/lib/swarm/episodic-store';

export interface QdrantFetchInit {
  readonly method: 'GET' | 'PUT' | 'POST';
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export interface QdrantFetchResponse {
  readonly status: number;
  readonly ok: boolean;
  text(): Promise<string>;
}

export type QdrantFetch = (
  url: string,
  init: QdrantFetchInit,
) => Promise<QdrantFetchResponse>;

export interface QdrantStoreOptions {
  readonly url: string;
  readonly fetchImpl: QdrantFetch;
  readonly collection?: string;
  readonly apiKey?: string;
  /** Explicit opt-out of collection creation for restricted clusters. */
  readonly ensureCollection?: boolean;
}

export type QdrantErrorCode = 'HTTP_ERROR' | 'MALFORMED_RESPONSE';

export class QdrantStoreError extends Error {
  readonly code: QdrantErrorCode;
  readonly status: number | null;

  constructor(code: QdrantErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'QdrantStoreError';
    this.code = code;
    this.status = status;
  }
}

export const DEFAULT_QDRANT_COLLECTION = 'failure_memories';

function pointIdFor(memory: FailureMemory): string {
  const hex = createHash('sha256')
    .update(`${memory.lesson_id}|${memory.module}|${memory.prevention_rule}`, 'utf8')
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

interface QdrantSearchResponse {
  readonly result?: ReadonlyArray<{ readonly score?: unknown; readonly payload?: unknown }>;
}

export class QdrantEpisodicFailureStore {
  private readonly baseUrl: string;
  private readonly collection: string;
  private readonly headers: Record<string, string>;
  private collectionReady: Promise<void> | null = null;

  constructor(private readonly options: QdrantStoreOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
    this.collection = options.collection ?? DEFAULT_QDRANT_COLLECTION;
    this.headers = {
      'content-type': 'application/json',
      ...(options.apiKey ? { 'api-key': options.apiKey } : {}),
    };
  }

  private url(suffix: string): string {
    return `${this.baseUrl}/collections/${encodeURIComponent(this.collection)}${suffix}`;
  }

  private async call(method: QdrantFetchInit['method'], suffix: string, body?: unknown) {
    const response = await this.options.fetchImpl(this.url(suffix), {
      method,
      headers: this.headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new QdrantStoreError(
        'HTTP_ERROR',
        `Qdrant responded ${response.status} for ${method} ${suffix}.`,
        response.status,
      );
    }
    return response;
  }

  private async ensureCollection(): Promise<void> {
    if (this.options.ensureCollection === false) return;
    if (!this.collectionReady) {
      this.collectionReady = this.createCollection();
    }
    return this.collectionReady;
  }

  private async createCollection(): Promise<void> {
    const response = await this.options.fetchImpl(this.url(''), {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
      }),
    });

    // 409 means the collection already exists, which is the desired end state.
    if (!response.ok && response.status !== 409) {
      throw new QdrantStoreError(
        'HTTP_ERROR',
        `Could not create Qdrant collection "${this.collection}" (status ${response.status}).`,
        response.status,
      );
    }
  }

  async add(memory: FailureMemory): Promise<void> {
    const parsed = FailureMemorySchema.parse(memory);
    await this.ensureCollection();
    const vector = Array.from(embed(`${parsed.module} ${parsed.root_cause} ${parsed.prevention_rule}`));

    await this.call('PUT', '/points?wait=true', {
      points: [{ id: pointIdFor(parsed), vector, payload: parsed }],
    });
  }

  async search(query: string, k = 3): Promise<readonly RankedMemory[]> {
    if (k <= 0) return [];
    await this.ensureCollection();

    const response = await this.call('POST', '/points/search', {
      vector: Array.from(embed(query)),
      limit: k,
      with_payload: true,
    });

    let parsed: QdrantSearchResponse;
    try {
      parsed = JSON.parse(await response.text()) as QdrantSearchResponse;
    } catch {
      throw new QdrantStoreError('MALFORMED_RESPONSE', 'Qdrant search returned non-JSON.');
    }

    if (!Array.isArray(parsed.result)) {
      throw new QdrantStoreError('MALFORMED_RESPONSE', 'Qdrant search returned no result array.');
    }

    return parsed.result.map((hit) => ({
      memory: FailureMemorySchema.parse(hit.payload as unknown),
      score: typeof hit.score === 'number' ? hit.score : 0,
    }));
  }

  async size(): Promise<number> {
    const response = await this.call('GET', '');
    const parsed = JSON.parse(await response.text()) as { result?: { points_count?: unknown } };
    const count = parsed.result?.points_count;
    if (typeof count !== 'number') {
      throw new QdrantStoreError('MALFORMED_RESPONSE', 'Qdrant collection info had no point count.');
    }
    return count;
  }
}
