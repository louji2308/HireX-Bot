import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/interview/emergency-invite/route';

describe('Phase 7 emergency invite route', () => {
  it('creates a priority-one override from a same-origin request', async () => {
    const request = new Request('http://localhost/api/interview/emergency-invite', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({
        candidateId: '00000000-0000-4000-8000-000000000701',
        company: 'Amazon',
        role: 'Software Development Engineer',
        round: 'Coding',
        deadlineIso: '2026-11-10T12:00:00.000Z',
        now: '2026-10-25T12:00:00.000Z',
      }),
    }) as unknown as Request;
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.active).toBe(true);
    expect(body.priority).toBe(1);
    expect(body.routine_paused).toBe(true);
    expect(body.durable).toBe(false);
  });

  it('rejects a cross-origin request', async () => {
    const request = new Request('http://localhost/api/interview/emergency-invite', {
      method: 'POST',
      headers: { origin: 'https://example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ candidateId: '00000000-0000-4000-8000-000000000701', company: 'Amazon', role: 'SDE', round: 'Coding', deadlineIso: '2026-11-10T12:00:00.000Z' }),
    }) as unknown as Request;
    const response = await POST(request as never);
    expect(response.status).toBe(403);
  });
});
