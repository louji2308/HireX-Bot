import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isIntakeSessionId } from '@/lib/onboarding/session-cookie';
import {
  PHASE5_CONTRACT_VERSION,
  type OpportunityStore,
  type OpportunityWorkspace,
} from '@/types/phase5_contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkspace(value: unknown): value is OpportunityWorkspace {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.contractVersion === PHASE5_CONTRACT_VERSION &&
    isIntakeSessionId(value.sessionId) &&
    typeof value.candidateId === 'string' &&
    Number.isInteger(value.revision) &&
    Array.isArray(value.jobs) &&
    Array.isArray(value.notices) &&
    isRecord(value.dedupe) &&
    (value.source === 'local_intake' || value.source === 'snapshot_preview') &&
    value.live === false
  );
}

export function defaultOpportunityRoot(): string {
  return (
    process.env.HIREX_OPPORTUNITY_DIR?.trim() ||
    path.join(process.cwd(), '.hirex-local', 'opportunities')
  );
}

export class FileOpportunityStore implements OpportunityStore {
  readonly durable = false;
  private readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();
  private rootReady: Promise<void> | null = null;

  constructor(root = defaultOpportunityRoot()) {
    this.root = root;
  }

  private async ensureRoot(): Promise<void> {
    if (!this.rootReady) {
      this.rootReady = mkdir(this.root, { recursive: true, mode: 0o700 }).then(() => undefined);
    }
    return this.rootReady;
  }

  private fileFor(sessionId: string): string {
    if (!isIntakeSessionId(sessionId)) {
      throw new Error('Invalid opportunity session id.');
    }
    return path.join(this.root, `${sessionId}.json`);
  }

  private async withLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(sessionId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const chained = run.then(
      () => undefined,
      () => undefined,
    );
    this.locks.set(sessionId, chained);
    try {
      return await run;
    } finally {
      if (this.locks.get(sessionId) === chained) this.locks.delete(sessionId);
    }
  }

  async read(sessionId: string): Promise<OpportunityWorkspace | null> {
    let filename: string;
    try {
      filename = this.fileFor(sessionId);
    } catch {
      return null;
    }

    try {
      await access(filename, constants.R_OK);
    } catch {
      return null;
    }

    try {
      const raw = await readFile(filename, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isWorkspace(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async write(workspace: OpportunityWorkspace): Promise<void> {
    if (!isWorkspace(workspace)) {
      throw new Error('Refusing to write an invalid opportunity workspace.');
    }
    await this.writeAtomic(workspace);
  }

  async update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: OpportunityWorkspace) => OpportunityWorkspace,
  ): Promise<OpportunityWorkspace | null> {
    return this.withLock(sessionId, async () => {
      const current = await this.read(sessionId);
      if (!current || current.revision !== expectedRevision) return null;

      const next = updater(current);
      if (!isWorkspace(next)) {
        throw new Error('The opportunity updater produced an invalid workspace.');
      }
      if (next.sessionId !== sessionId || next.candidateId !== current.candidateId) {
        throw new Error('The opportunity updater changed the workspace identity.');
      }
      if (next.revision <= current.revision) {
        throw new Error('The opportunity updater did not advance the revision.');
      }

      await this.writeAtomic(next);
      return next;
    });
  }

  async erase(sessionId: string): Promise<boolean> {
    return this.withLock(sessionId, async () => {
      let filename: string;
      try {
        filename = this.fileFor(sessionId);
      } catch {
        return false;
      }

      try {
        await unlink(filename);
        return true;
      } catch {
        return false;
      }
    });
  }

  private async writeAtomic(workspace: OpportunityWorkspace): Promise<void> {
    await this.ensureRoot();
    const filename = this.fileFor(workspace.sessionId);
    const temporary = `${filename}.${String(process.pid)}.${String(Date.now())}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`;

    await writeFile(temporary, `${JSON.stringify(workspace, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });

    try {
      await rename(temporary, filename);
    } catch (error) {
      if (isRecord(error) && (error.code === 'EEXIST' || error.code === 'EPERM')) {
        await rm(filename, { force: true });
        await rename(temporary, filename);
        return;
      }
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
