import type { PracticeSessionRecord } from '@/types/phase7_contracts';

export interface PracticeSessionStore {
  readonly durable: false;
  read(sessionId: string): Promise<PracticeSessionRecord | null>;
  write(record: PracticeSessionRecord): Promise<void>;
  erase(sessionId: string): Promise<boolean>;
}

export class MemoryPracticeSessionStore implements PracticeSessionStore {
  readonly durable = false;
  private readonly records = new Map<string, PracticeSessionRecord>();

  async read(sessionId: string): Promise<PracticeSessionRecord | null> {
    const record = this.records.get(sessionId);
    return record ? structuredClone(record) : null;
  }

  async write(record: PracticeSessionRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async erase(sessionId: string): Promise<boolean> {
    return this.records.delete(sessionId);
  }
}
