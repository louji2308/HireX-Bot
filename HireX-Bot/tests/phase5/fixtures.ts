import { completeIntake } from '@/lib/onboarding/intake-machine';
import { loadOpportunitySnapshots } from '@/lib/opportunities/snapshot-source';
import { discoverOpportunities, toBoardResponse } from '@/agents/module4-discovery/workspace';
import { sampleCandidate } from '@/agents/module4-discovery/candidate';
import type {
  OpportunityStore,
  OpportunityWorkspace,
} from '@/types/phase5_contracts';
import {
  HAPPY_ANSWERS,
  driveAnswers,
  sessionAtStart,
  withConsent,
  withWorkspaceProfile,
  type AnswerStep,
} from '../phase4/fixtures';

export const NOW = new Date('2026-10-24T12:00:00.000Z');
export const TEST_SESSION_ID = 'a'.repeat(64);
export const TEST_CANDIDATE_ID = '00000000-0000-4000-8000-000000000501';

export const DISCOVERY_ANSWERS: readonly AnswerStep[] = HAPPY_ANSWERS.map((step) => {
  if ('skip' in step) return step;
  if (step.signalId === 1) return { signalId: 1, value: ['full_stack'] };
  if (step.signalId === 2) {
    return {
      signalId: 2,
      value: ['typescript_javascript', 'python', 'sql', 'react', 'node'],
    };
  }
  if (step.signalId === 6) return { signalId: 6, value: 'flexible' };
  if (step.signalId === 7) return { signalId: 7, value: ['full_time', 'internship'] };
  if (step.signalId === 8) return { signalId: 8, value: '10k_20k_month' };
  if (step.signalId === 9) return { signalId: 9, value: 'two_weeks' };
  return step;
});

export function completedDiscoverySession() {
  const ready = withConsent(withWorkspaceProfile(driveAnswers(sessionAtStart(), DISCOVERY_ANSWERS)));
  const result = completeIntake(ready, '2026-05-01T02:00:00.000Z', ready.revision);
  if (result.status !== 'applied' || !result.session) {
    throw new Error(`Expected a completed intake, received ${result.status}.`);
  }
  return result.session;
}

export async function capturedSnapshots() {
  return loadOpportunitySnapshots();
}

export async function sampleWorkspace(sessionId = TEST_SESSION_ID) {
  const snapshots = await capturedSnapshots();
  return discoverOpportunities({
    snapshots,
    candidate: sampleCandidate(),
    sessionId,
    candidateId: TEST_CANDIDATE_ID,
    source: 'snapshot_preview',
    sampleCandidate: true,
    now: NOW,
  });
}

export async function sampleBoard() {
  return toBoardResponse(await sampleWorkspace());
}

export class MemoryOpportunityStore implements OpportunityStore {
  readonly durable = false;
  private readonly workspaces = new Map<string, OpportunityWorkspace>();

  async read(sessionId: string): Promise<OpportunityWorkspace | null> {
    const workspace = this.workspaces.get(sessionId);
    return workspace ? structuredClone(workspace) : null;
  }

  async write(workspace: OpportunityWorkspace): Promise<void> {
    this.workspaces.set(workspace.sessionId, structuredClone(workspace));
  }

  async update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: OpportunityWorkspace) => OpportunityWorkspace,
  ): Promise<OpportunityWorkspace | null> {
    const current = this.workspaces.get(sessionId);
    if (!current || current.revision !== expectedRevision) return null;
    const next = updater(structuredClone(current));
    if (next.revision <= current.revision) {
      throw new Error('Memory opportunity store requires a new revision.');
    }
    this.workspaces.set(sessionId, structuredClone(next));
    return structuredClone(next);
  }

  async erase(sessionId: string): Promise<boolean> {
    return this.workspaces.delete(sessionId);
  }
}
