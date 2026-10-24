import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { withSavedState } from '@/agents/module4-discovery/workspace';
import { FileOpportunityStore } from '@/lib/opportunities/file-store';

import { sampleWorkspace, TEST_SESSION_ID } from './fixtures';

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hirex-opp-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 5 local opportunity store', () => {
  it('writes, reads, updates, and erases a workspace inside the configured root', async () => {
    const root = await tempRoot();
    const store = new FileOpportunityStore(root);
    const workspace = await sampleWorkspace();
    expect(store.durable).toBe(false);

    await store.write(workspace);
    const saved = await readFile(path.join(root, `${TEST_SESSION_ID}.json`), 'utf8');
    expect(saved).toContain('phase5.discovery.v1');
    expect(saved).not.toContain('full_name');

    const read = await store.read(TEST_SESSION_ID);
    expect(read?.jobs).toHaveLength(7);

    const first = workspace.jobs[0]!;
    const updated = await store.update(TEST_SESSION_ID, workspace.revision, (current) => {
      const next = withSavedState(current, first.pipeline_id, true);
      if (!next) throw new Error('Fixture pipeline was not found.');
      return next;
    });
    expect(updated?.revision).toBe(workspace.revision + 1);
    expect(updated?.jobs.find((job) => job.pipeline_id === first.pipeline_id)?.saved).toBe(true);

    expect(await store.update(TEST_SESSION_ID, workspace.revision, (current) => current)).toBeNull();
    expect(await store.erase(TEST_SESSION_ID)).toBe(true);
    expect(await store.read(TEST_SESSION_ID)).toBeNull();
  });

  it('rejects an invalid session id and ignores a malformed file', async () => {
    const root = await tempRoot();
    const store = new FileOpportunityStore(root);
    const workspace = await sampleWorkspace();
    await expect(store.write({ ...workspace, sessionId: 'preview' })).rejects.toThrow(
      /invalid opportunity workspace/i,
    );

    await writeFile(path.join(root, `${TEST_SESSION_ID}.json`), '{"version":1}', 'utf8');
    expect(await store.read(TEST_SESSION_ID)).toBeNull();
  });
});
