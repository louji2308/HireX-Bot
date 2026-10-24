import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createIntakeSession } from '@/lib/onboarding/intake-machine';
import { isIntakeSessionId } from '@/lib/onboarding/session-cookie';
import type {
  IntakeSession,
  IntakeStore,
  IntakeStoreUpdate,
} from '@/types/phase4_contracts';

const FILE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntakeSession(value: unknown): value is IntakeSession {
  if (!isRecord(value)) return false;
  return (
    value.version === FILE_VERSION &&
    value.contractVersion === 'phase4.intake.v1' &&
    value.taxonomyVersion === '34-signal.v1' &&
    isIntakeSessionId(value.sessionId) &&
    typeof value.candidateId === 'string' &&
    Number.isInteger(value.revision) &&
    isRecord(value.signals) &&
    isRecord(value.consent) &&
    isRecord(value.profile)
  );
}

function defaultRoot(): string {
  return process.env.HIREX_INTAKE_DIR?.trim() || path.join(process.cwd(), '.hirex-local', 'intake');
}

export class FileIntakeStore implements IntakeStore {
  readonly durable = false;
  private readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();
  private rootReady: Promise<void> | null = null;

  constructor(root = defaultRoot()) {
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
      throw new Error('Invalid intake session id.');
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

  async create(
    seed?: Partial<Pick<IntakeSession, 'candidateId' | 'createdAt'>>,
  ): Promise<IntakeSession> {
    const session = createIntakeSession(seed);
    await this.ensureRoot();
    await this.writeAtomic(session);
    return session;
  }

  async read(sessionId: string): Promise<IntakeSession | null> {
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
      return isIntakeSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: IntakeSession) => IntakeSession,
  ): Promise<IntakeStoreUpdate> {
    return this.withLock(sessionId, async () => {
      const current = await this.read(sessionId);
      if (!current) return { status: 'not_found', session: null };
      if (current.revision !== expectedRevision) {
        return { status: 'conflict', session: current };
      }

      const next = updater(current);
      if (!isIntakeSession(next)) {
        throw new Error('The intake updater produced an invalid session.');
      }
      if (next.sessionId !== sessionId || next.candidateId !== current.candidateId) {
        throw new Error('The intake updater changed the session identity.');
      }
      if (next.revision <= current.revision) {
        throw new Error('The intake updater did not advance the revision.');
      }

      await this.writeAtomic(next);
      return { status: 'applied', session: next };
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
      } catch (error) {
        if (isRecord(error) && error.code === 'ENOENT') return false;
        return false;
      }
    });
  }

  private async writeAtomic(session: IntakeSession): Promise<void> {
    await this.ensureRoot();
    const filename = this.fileFor(session.sessionId);
    const temporary = `${filename}.${String(process.pid)}.${String(Date.now())}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`;

    await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, {
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
