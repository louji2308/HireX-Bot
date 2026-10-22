import { describe, expect, it } from 'vitest';

import { waitForApproval, waitForUserInput } from '@/inngest/state-machine';
import {
  APPROVAL_TIMEOUT_HOURS,
  USER_INPUT_TIMEOUT,
  type DurableStepLike,
} from '@/types/phase3_contracts';

const TASK_ID = 'task-1';
const CANDIDATE_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_CANDIDATE_ID = '00000000-0000-4000-8000-000000000002';
const INPUT_REQUEST_ID = 'input-1';
const T0 = '2026-01-01T00:00:00.000Z';

function stepReturning(event: { data?: unknown } | null) {
  const calls: Array<{
    id: string;
    options: Parameters<DurableStepLike['waitForEvent']>[1];
  }> = [];

  return {
    calls,
    step: {
      async waitForEvent(
        id: string,
        options: Parameters<DurableStepLike['waitForEvent']>[1],
      ) {
        calls.push({ id, options });
        return event;
      },
    },
  };
}

describe('durable approval and user-input waits', () => {
  it('waits for approval with the frozen timeout and rejects another candidate', async () => {
    const fake = stepReturning({
      data: {
        taskId: TASK_ID,
        candidateId: OTHER_CANDIDATE_ID,
        decision: 'approved',
        eventId: 'decision-1',
        resolvedAt: T0,
      },
    });

    const result = await waitForApproval(fake.step, TASK_ID, CANDIDATE_ID);

    expect(fake.calls[0]).toEqual({
      id: `approval:${TASK_ID}`,
      options: {
        event: 'application/approval.resolved',
        timeout: `${APPROVAL_TIMEOUT_HOURS}h`,
        match: 'data.taskId',
      },
    });
    expect(result.timedOut).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.resolution).toMatchObject({
      decision: 'invalid',
      candidateId: CANDIDATE_ID,
    });
  });

  it('waits for a specific input request and accepts only the matching candidate', async () => {
    const fake = stepReturning({
      data: {
        taskId: TASK_ID,
        candidateId: CANDIDATE_ID,
        inputRequestId: INPUT_REQUEST_ID,
        suppliedAt: T0,
      },
    });

    const result = await waitForUserInput(
      fake.step,
      TASK_ID,
      CANDIDATE_ID,
      INPUT_REQUEST_ID,
    );

    expect(fake.calls[0]).toEqual({
      id: `user-input:${TASK_ID}`,
      options: {
        event: 'user.input.supplied',
        timeout: USER_INPUT_TIMEOUT,
        match: 'data.taskId',
      },
    });
    expect(result).toMatchObject({
      accepted: true,
      timedOut: false,
      payload: {
        taskId: TASK_ID,
        candidateId: CANDIDATE_ID,
        inputRequestId: INPUT_REQUEST_ID,
      },
    });
  });

  it('rejects an input response for another candidate or request', async () => {
    const wrongCandidate = await waitForUserInput(
      stepReturning({
        data: {
          taskId: TASK_ID,
          candidateId: OTHER_CANDIDATE_ID,
          inputRequestId: INPUT_REQUEST_ID,
          suppliedAt: T0,
        },
      }).step,
      TASK_ID,
      CANDIDATE_ID,
      INPUT_REQUEST_ID,
    );
    expect(wrongCandidate).toEqual({ accepted: false, payload: null, timedOut: false });

    const wrongRequest = await waitForUserInput(
      stepReturning({
        data: {
          taskId: TASK_ID,
          candidateId: CANDIDATE_ID,
          inputRequestId: 'input-other',
          suppliedAt: T0,
        },
      }).step,
      TASK_ID,
      CANDIDATE_ID,
      INPUT_REQUEST_ID,
    );
    expect(wrongRequest).toEqual({ accepted: false, payload: null, timedOut: false });
  });

  it('reports timeout separately from an invalid response', async () => {
    const timedOut = await waitForUserInput(
      stepReturning(null).step,
      TASK_ID,
      CANDIDATE_ID,
      INPUT_REQUEST_ID,
    );
    expect(timedOut).toEqual({ accepted: false, payload: null, timedOut: true });

    const invalid = await waitForUserInput(
      stepReturning({ data: { taskId: TASK_ID } }).step,
      TASK_ID,
      CANDIDATE_ID,
      INPUT_REQUEST_ID,
    );
    expect(invalid).toEqual({ accepted: false, payload: null, timedOut: false });
  });
});
