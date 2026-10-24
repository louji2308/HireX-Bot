import { describe, expect, it } from 'vitest';

import { dedupeSnapshots } from '@/agents/module4-discovery/dedupe';

import { capturedSnapshots } from './fixtures';

describe('Phase 5 candidate-scoped dedupe', () => {
  it('merges duplicate source records and reports the group', async () => {
    const snapshots = await capturedSnapshots();
    const first = snapshots[0]!;
    const duplicate = { ...first, captured_at: '2026-10-25T00:00:00.000Z' };
    const result = dedupeSnapshots([...snapshots, duplicate]);

    expect(result.snapshots).toHaveLength(7);
    expect(result.report.input_count).toBe(8);
    expect(result.report.unique_count).toBe(7);
    expect(result.report.merged_groups).toEqual([
      { source_job_id: first.source_job_id, sources: [first.source] },
    ]);
    expect(
      result.snapshots.find((snapshot) => snapshot.source_job_id === first.source_job_id)?.captured_at,
    ).toBe('2026-10-25T00:00:00.000Z');
  });

  it('reports a same-role collision without silently merging different source ids', async () => {
    const snapshots = await capturedSnapshots();
    const first = snapshots[0]!;
    const collision = {
      ...first,
      source_job_id: 'different-source-id',
      captured_at: '2026-10-25T00:00:00.000Z',
    };
    const result = dedupeSnapshots([...snapshots, collision]);

    expect(result.snapshots).toHaveLength(8);
    expect(result.report.collisions).toHaveLength(1);
    expect(result.report.collisions[0]?.source_job_ids).toEqual(
      [first.source_job_id, 'different-source-id'].sort(),
    );
    expect(result.report.unique_count).toBe(8);
  });

  it('does not merge different roles at the same company', async () => {
    const snapshots = await capturedSnapshots();
    const result = dedupeSnapshots([
      ...snapshots,
      {
        ...snapshots[0]!,
        source_job_id: 'role-2',
        title: 'A different role',
      },
    ]);
    expect(result.report.collisions).toHaveLength(0);
    expect(result.snapshots).toHaveLength(8);
  });
});
