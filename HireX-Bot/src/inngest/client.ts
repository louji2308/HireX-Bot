import { Inngest } from 'inngest';

/**
 * Phase 3 ships the real typed client and a real serve endpoint, but no
 * product functions yet. The route intentionally registers an empty function
 * list until the feature phases add durable workflows.
 */
export const inngest = new Inngest({ id: 'hirex-bot' });
