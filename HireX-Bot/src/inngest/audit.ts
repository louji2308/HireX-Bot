import { createHash } from 'node:crypto';

import type { WorkflowAuditRecord } from '@/types/phase3_contracts';

export const WORKFLOW_AUDIT_CHAIN_VERSION = 'hirex/workflow-audit/v1' as const;
export const WORKFLOW_AUDIT_GENESIS_HASH = '0'.repeat(64);

export interface AuditChainVerification {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function computeWorkflowAuditHash(
  record: Omit<WorkflowAuditRecord, 'auditHash'>,
): string {
  const canonical = JSON.stringify([
    WORKFLOW_AUDIT_CHAIN_VERSION,
    record.seq,
    record.taskId,
    record.candidateId,
    record.fromState,
    record.toState,
    record.reason,
    record.outcome,
    record.sideEffectExecuted,
    record.actor,
    record.occurredAt,
    record.eventId,
    record.stepName,
    record.resolutionId,
    record.idempotencyKey,
    record.prevHash,
  ]);

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function verifyWorkflowAuditChain(
  records: readonly WorkflowAuditRecord[],
): AuditChainVerification {
  const errors: string[] = [];
  let previousHash = WORKFLOW_AUDIT_GENESIS_HASH;

  records.forEach((record, index) => {
    const expectedSeq = index + 1;

    if (record.seq !== expectedSeq) {
      errors.push(`record ${index}: expected seq ${expectedSeq}, received ${record.seq}`);
    }

    if (record.prevHash !== previousHash) {
      errors.push(`record ${index}: prevHash does not match the previous record`);
    }

    const recomputed = computeWorkflowAuditHash({
      seq: record.seq,
      taskId: record.taskId,
      candidateId: record.candidateId,
      fromState: record.fromState,
      toState: record.toState,
      reason: record.reason,
      outcome: record.outcome,
      sideEffectExecuted: record.sideEffectExecuted,
      actor: record.actor,
      occurredAt: record.occurredAt,
      eventId: record.eventId,
      stepName: record.stepName,
      resolutionId: record.resolutionId,
      idempotencyKey: record.idempotencyKey,
      prevHash: record.prevHash,
    });

    if (recomputed !== record.auditHash) {
      errors.push(`record ${index}: auditHash does not match its contents`);
    }

    previousHash = record.auditHash;
  });

  return { valid: errors.length === 0, errors };
}
