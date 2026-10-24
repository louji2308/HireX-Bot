import { createIntakeSession } from '@/lib/onboarding/intake-machine';
import { isIntakeSessionId } from '@/lib/onboarding/session-cookie';
import type {
  IntakeSession,
  IntakeStore,
  IntakeStoreUpdate,
} from '@/types/phase4_contracts';

function clone(session: IntakeSession): IntakeSession {
  return structuredClone(session);
}

/**
 * Test adapter. It preserves the same revision and erase semantics as the file
 * store but is not durable and must never be presented as production storage.
 */
export class MemoryIntakeStore implements IntakeStore {
  readonly durable = false;
  private readonly sessions = new Map<string, IntakeSession>();

  async create(
    seed?: Partial<Pick<IntakeSession, 'candidateId' | 'createdAt'>>,
  ): Promise<IntakeSession> {
    const session = createIntakeSession(seed);
    this.sessions.set(session.sessionId, clone(session));
    return clone(session);
  }

  async read(sessionId: string): Promise<IntakeSession | null> {
    if (!isIntakeSessionId(sessionId)) return null;
    const session = this.sessions.get(sessionId);
    return session ? clone(session) : null;
  }

  async update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: IntakeSession) => IntakeSession,
  ): Promise<IntakeStoreUpdate> {
    if (!isIntakeSessionId(sessionId)) return { status: 'not_found', session: null };
    const current = this.sessions.get(sessionId);
    if (!current) return { status: 'not_found', session: null };
    if (current.revision !== expectedRevision) {
      return { status: 'conflict', session: clone(current) };
    }

    const next = updater(clone(current));
    if (next.sessionId !== current.sessionId || next.candidateId !== current.candidateId) {
      throw new Error('The intake updater changed the session identity.');
    }
    if (next.revision <= current.revision) {
      throw new Error('The intake updater did not advance the revision.');
    }

    this.sessions.set(sessionId, clone(next));
    return { status: 'applied', session: clone(next) };
  }

  async erase(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
}
