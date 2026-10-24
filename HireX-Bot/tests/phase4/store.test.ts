import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileIntakeStore } from '@/lib/onboarding/file-store';
import { MemoryIntakeStore } from '@/lib/onboarding/memory-store';
import {
  INTAKE_COOKIE_MAX_AGE_SECONDS,
  INTAKE_COOKIE_NAME,
  intakeCookieOptions,
  isIntakeSessionId,
} from '@/lib/onboarding/session-cookie';
import { applyAnswer } from '@/lib/onboarding/intake-machine';

const roots: string[] = [];

async function root() {
  const directory = await mkdtemp(path.join(tmpdir(), 'hirex-phase4-'));
  roots.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Phase 4 intake stores', () => {
  it('persists a draft across file-store instances without claiming durability', async () => {
    const directory = await root();
    const first = new FileIntakeStore(directory);
    const created = await first.create({
      candidateId: '00000000-0000-4000-8000-000000000101',
      createdAt: '2026-05-01T00:00:00.000Z',
    });

    expect(first.durable).toBe(false);
    expect(isIntakeSessionId(created.sessionId)).toBe(true);

    const reopened = new FileIntakeStore(directory);
    const read = await reopened.read(created.sessionId);
    expect(read).toEqual(created);
    expect(await reopened.read('../../etc/passwd')).toBeNull();
  });

  it('applies optimistic revisions and rejects a stale write', async () => {
    const directory = await root();
    const store = new FileIntakeStore(directory);
    const created = await store.create();
    const next = applyAnswer(
      created,
      1,
      ['backend_sde'],
      '2026-05-01T00:00:00.000Z',
      created.revision,
    );
    expect(next.session).not.toBeNull();

    const applied = await store.update(created.sessionId, created.revision, () => next.session!);
    expect(applied.status).toBe('applied');
    expect(applied.session?.revision).toBe(created.revision + 1);

    const stale = await store.update(created.sessionId, created.revision, () => next.session!);
    expect(stale.status).toBe('conflict');
    expect(stale.session?.revision).toBe(created.revision + 1);
  });

  it('serializes concurrent writes so only one revision wins', async () => {
    const directory = await root();
    const store = new FileIntakeStore(directory);
    const created = await store.create();

    const one = applyAnswer(created, 1, ['backend_sde'], '2026-05-01T00:00:00.000Z', 0);
    const two = applyAnswer(created, 1, ['full_stack'], '2026-05-01T00:00:00.000Z', 0);

    const [first, second] = await Promise.all([
      store.update(created.sessionId, 0, () => one.session!),
      store.update(created.sessionId, 0, () => two.session!),
    ]);

    expect([first.status, second.status].sort()).toEqual(['applied', 'conflict']);
  });

  it('erases a draft and reports whether it existed', async () => {
    const directory = await root();
    const store = new FileIntakeStore(directory);
    const created = await store.create();
    expect(await store.erase(created.sessionId)).toBe(true);
    expect(await store.read(created.sessionId)).toBeNull();
    expect(await store.erase(created.sessionId)).toBe(false);
  });

  it('uses the same revision semantics in the memory adapter', async () => {
    const store = new MemoryIntakeStore();
    const created = await store.create();
    const next = applyAnswer(created, 1, ['backend_sde'], '2026-05-01T00:00:00.000Z', 0);
    const applied = await store.update(created.sessionId, 0, () => next.session!);
    expect(applied.status).toBe('applied');
    expect((await store.read(created.sessionId))?.revision).toBe(1);
    expect(await store.erase(created.sessionId)).toBe(true);
    expect(await store.read(created.sessionId)).toBeNull();
  });
});

describe('Phase 4 intake cookie contract', () => {
  it('is httpOnly, same-site and bounded to seven days', () => {
    const options = intakeCookieOptions();
    expect(INTAKE_COOKIE_NAME).toBe('hirex_intake');
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    expect(INTAKE_COOKIE_MAX_AGE_SECONDS).toBe(604_800);
  });

  it('accepts only 64 lowercase hex characters', () => {
    expect(isIntakeSessionId('a'.repeat(64))).toBe(true);
    expect(isIntakeSessionId('A'.repeat(64))).toBe(false);
    expect(isIntakeSessionId('a'.repeat(63))).toBe(false);
    expect(isIntakeSessionId('../draft')).toBe(false);
  });
});
