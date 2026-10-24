import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  OpportunityProvenance,
  OpportunitySnapshot,
} from '@/types/phase5_contracts';

import { parseOpportunitySnapshot } from './snapshot-schema';

export const DEFAULT_SNAPSHOT_DIR = path.join(
  process.cwd(),
  'data',
  'opportunity-snapshots',
  '20261024',
);

const SOURCE_LABELS: Readonly<Record<OpportunitySnapshot['source'], string>> = {
  greenhouse_public: 'Greenhouse public board',
  ashby_public: 'Ashby public posting API',
  synthetic_fixture: 'Synthetic fixture',
};

export function snapshotSourceLabel(source: OpportunitySnapshot['source']): string {
  return SOURCE_LABELS[source];
}

export function snapshotContentHash(snapshot: OpportunitySnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function snapshotProvenance(snapshot: OpportunitySnapshot): OpportunityProvenance {
  return {
    source: snapshot.source,
    source_label: snapshotSourceLabel(snapshot.source),
    source_url: snapshot.url,
    captured_at: snapshot.captured_at,
    source_updated_at: snapshot.source_updated_at,
    published_at: snapshot.published_at,
    valid_through: snapshot.valid_through,
    content_sha256: snapshotContentHash(snapshot),
    capture_method: snapshot.capture_method,
    live: false,
    synthetic: snapshot.synthetic,
  };
}

export async function readSnapshotFile(filePath: string): Promise<OpportunitySnapshot> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown read error';
    throw new Error(`Could not read opportunity snapshot ${path.basename(filePath)}: ${detail}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(`Invalid JSON in opportunity snapshot ${path.basename(filePath)}: ${detail}`);
  }

  try {
    return parseOpportunitySnapshot(parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'schema validation failed';
    throw new Error(`Invalid opportunity snapshot ${path.basename(filePath)}: ${detail}`);
  }
}

export async function loadOpportunitySnapshots(
  directory: string = DEFAULT_SNAPSHOT_DIR,
): Promise<OpportunitySnapshot[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`No opportunity snapshot JSON files found in ${directory}.`);
  }

  return Promise.all(files.map((file) => readSnapshotFile(path.join(directory, file))));
}
