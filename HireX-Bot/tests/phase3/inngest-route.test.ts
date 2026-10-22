import { describe, expect, it } from 'vitest';

import { GET, POST, PUT } from '@/app/api/inngest/route';

describe('Inngest serve route', () => {
  it('exports the real Next.js GET, POST and PUT handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
    expect(typeof PUT).toBe('function');
  });
});
