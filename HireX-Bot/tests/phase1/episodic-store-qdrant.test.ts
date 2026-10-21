import { describe, expect, it } from 'vitest';
import {
  QdrantEpisodicFailureStore,
  QdrantStoreError,
  type QdrantFetch,
} from '@/lib/swarm/qdrant-store';
import { selectEpisodicStore } from '@/lib/swarm/store-factory';
import { EMBEDDING_DIMENSIONS, type FailureMemory } from '@/lib/swarm/episodic-store';

const memory: FailureMemory = {
  schema_version: 1,
  lesson_id: 'L-001',
  phase: 1,
  module: 'security/untrusted-envelope',
  error_class: 'sanitizer_bypass',
  root_cause: 'Encoded closing tag slipped past the literal regex.',
  prevention_rule: 'Decode entities before stripping delimiters.',
  confidence: 0.95,
  verification_state: 'verified',
  created_at: '2026-10-21T00:00:00.000Z',
  tags: ['security'],
};

const recorder = (handler: (url: string, body: unknown) => { status: number; body: unknown }) => {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const fetchImpl: QdrantFetch = async (url, init) => {
    const parsedBody = init.body ? (JSON.parse(init.body) as unknown) : undefined;
    const result = handler(url, parsedBody);
    calls.push({ method: init.method, url, body: parsedBody });
    return {
      status: result.status,
      ok: result.status >= 200 && result.status < 300,
      text: async () => JSON.stringify(result.body),
    };
  };
  return { calls, fetchImpl };
};

describe('Qdrant episodic store', () => {
  it('creates the collection once, then upserts the memory with a full-size vector', async () => {
    const { calls, fetchImpl } = recorder(() => ({ status: 200, body: { result: true } }));
    const store = new QdrantEpisodicFailureStore({
      url: 'http://qdrant.test:6333',
      fetchImpl,
      collection: 'failure_memories',
    });

    await store.add(memory);
    await store.add({ ...memory, lesson_id: 'L-002' });

    const creates = calls.filter((call) => call.method === 'PUT' && call.url.endsWith('/failure_memories'));
    expect(creates).toHaveLength(1);
    expect((creates[0]?.body as { vectors: { size: number; distance: string } }).vectors).toEqual({
      size: EMBEDDING_DIMENSIONS,
      distance: 'Cosine',
    });

    const upserts = calls.filter((call) => call.url.includes('/points?wait=true'));
    expect(upserts).toHaveLength(2);
    const point = (upserts[0]?.body as { points: Array<{ id: string; vector: number[]; payload: FailureMemory }> })
      .points[0];
    expect(point?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(point?.vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(point?.payload.lesson_id).toBe('L-001');
  });

  it('treats an already-existing collection (409) as success', async () => {
    const { fetchImpl } = recorder((url) =>
      url.includes('/points') ? { status: 200, body: {} } : { status: 409, body: { status: 'error' } },
    );
    const store = new QdrantEpisodicFailureStore({ url: 'http://qdrant.test:6333', fetchImpl });

    await expect(store.add(memory)).resolves.toBeUndefined();
    await expect(
      new QdrantEpisodicFailureStore({
        url: 'http://qdrant.test:6333',
        fetchImpl: async () => ({ status: 403, ok: false, text: async () => '' }),
      }).add(memory),
    ).rejects.toBeInstanceOf(QdrantStoreError);
  });

  it('maps search hits to ranked memories and rejects malformed payloads', async () => {
    const { fetchImpl } = recorder((url) =>
      url.endsWith('/points/search')
        ? { status: 200, body: { result: [{ score: 0.87, payload: memory }] } }
        : { status: 200, body: { result: { points_count: 1 } } },
    );
    const store = new QdrantEpisodicFailureStore({ url: 'http://qdrant.test:6333', fetchImpl });

    const hits = await store.search('encoded closing tag', 3);

    expect(hits).toHaveLength(1);
    expect(hits[0]?.score).toBe(0.87);
    expect(hits[0]?.memory.prevention_rule).toContain('Decode');
  });

  it('surfaces an HTTP failure instead of returning an empty memory set', async () => {
    const { fetchImpl } = recorder(() => ({ status: 503, body: {} }));
    const store = new QdrantEpisodicFailureStore({ url: 'http://qdrant.test:6333', fetchImpl });

    await expect(store.search('anything')).rejects.toMatchObject({ status: 503 });
  });

  it('sends the API key when configured', async () => {
    const headers: Array<Record<string, string>> = [];
    const fetchImpl: QdrantFetch = async (_url, init) => {
      headers.push(init.headers);
      return { status: 200, ok: true, text: async () => JSON.stringify({ result: true }) };
    };
    const store = new QdrantEpisodicFailureStore({
      url: 'https://qdrant.example',
      fetchImpl,
      apiKey: 'test-key',
    });

    await store.add(memory);

    expect(headers.every((header) => header['api-key'] === 'test-key')).toBe(true);
  });
});

describe('episodic store selection', () => {
  it('defaults to the JSONL ledger when QDRANT_URL is absent', () => {
    const selection = selectEpisodicStore({ env: {} });

    expect(selection.kind).toBe('jsonl');
    expect(selection.detail).toContain('QDRANT_URL is not set');
  });

  it('selects Qdrant only when a URL and a transport are supplied', () => {
    const { fetchImpl } = recorder(() => ({ status: 200, body: {} }));

    expect(() => selectEpisodicStore({ env: { QDRANT_URL: 'http://qdrant.test' } })).toThrow(
      /no fetch implementation/,
    );

    const selection = selectEpisodicStore({
      env: { QDRANT_URL: 'http://qdrant.test', QDRANT_COLLECTION: 'fm' },
      fetchImpl,
    });
    expect(selection.kind).toBe('qdrant');
    expect(selection.detail).toContain('fm');
  });
});
