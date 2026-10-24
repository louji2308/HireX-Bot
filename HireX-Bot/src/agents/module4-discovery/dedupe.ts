import type {
  DedupeReport,
  OpportunitySnapshot,
  OpportunitySource,
} from '@/types/phase5_contracts';

function normalizeKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jobKey(snapshot: OpportunitySnapshot): string {
  const locations = [...snapshot.locations].sort().join(',');
  return `${normalizeKey(snapshot.company)}|${normalizeKey(snapshot.title)}|${locations}`;
}

function sourceKey(snapshot: OpportunitySnapshot): string {
  return `${snapshot.source}:${snapshot.source_job_id}`;
}

function newestFirst(left: OpportunitySnapshot, right: OpportunitySnapshot): number {
  const byCapture = right.captured_at.localeCompare(left.captured_at);
  if (byCapture !== 0) return byCapture;
  return sourceKey(left).localeCompare(sourceKey(right));
}

export interface DedupeResult {
  readonly snapshots: readonly OpportunitySnapshot[];
  readonly report: DedupeReport;
}

export function dedupeSnapshots(snapshots: readonly OpportunitySnapshot[]): DedupeResult {
  const merged = new Map<string, OpportunitySnapshot[]>();
  for (const snapshot of snapshots) {
    const key = sourceKey(snapshot);
    const group = merged.get(key) ?? [];
    group.push(snapshot);
    merged.set(key, group);
  }

  const mergedGroups: { source_job_id: string; sources: OpportunitySource[] }[] = [];
  const selected: OpportunitySnapshot[] = [];
  for (const [, group] of [...merged.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [chosen] = [...group].sort(newestFirst);
    if (!chosen) continue;
    selected.push(chosen);
    if (group.length > 1) {
      const sources = [...new Set(group.map((snapshot) => snapshot.source))].sort() as OpportunitySource[];
      mergedGroups.push({ source_job_id: chosen.source_job_id, sources });
    }
  }

  const collisionMap = new Map<string, Set<string>>();
  for (const snapshot of selected) {
    const key = jobKey(snapshot);
    const ids = collisionMap.get(key) ?? new Set<string>();
    ids.add(snapshot.source_job_id);
    collisionMap.set(key, ids);
  }

  const collisions: { key: string; source_job_ids: string[] }[] = [];
  for (const [key, ids] of [...collisionMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (ids.size > 1) {
      collisions.push({ key, source_job_ids: [...ids].sort() });
    }
  }

  selected.sort(
    (left, right) =>
      left.company.localeCompare(right.company) ||
      left.title.localeCompare(right.title) ||
      left.source.localeCompare(right.source) ||
      left.source_job_id.localeCompare(right.source_job_id),
  );

  return {
    snapshots: selected,
    report: {
      input_count: snapshots.length,
      unique_count: selected.length,
      merged_groups: mergedGroups,
      collisions,
    },
  };
}
