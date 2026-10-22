import type { ProvenanceEntry } from '@/types/phase3_contracts';

/**
 * Static, inspectable facts for the judge-facing X-Ray panel. These entries
 * describe what this build does and does not connect to. They are not
 * generated telemetry and must never be presented as live model or workflow
 * traces.
 */
export function getPhase3ProvenanceEntries(): readonly ProvenanceEntry[] {
  return [
    {
      id: 'contract',
      label: 'Workflow contract',
      value: 'phase3.workflow.v1',
      source: 'static',
      observedAt: null,
    },
    {
      id: 'route',
      label: 'Inngest endpoint',
      value: '/api/inngest',
      source: 'static',
      observedAt: null,
    },
    {
      id: 'functions',
      label: 'Registered functions',
      value: '0 in this build',
      source: 'static',
      observedAt: null,
    },
    {
      id: 'model',
      label: 'Model call',
      value: 'Not invoked on this route',
      source: 'unavailable',
      observedAt: null,
    },
    {
      id: 'database',
      label: 'Database read',
      value: 'No table read',
      source: 'unavailable',
      observedAt: null,
    },
    {
      id: 'agentcert',
      label: 'AgentCert',
      value: 'Not connected',
      source: 'unavailable',
      observedAt: null,
    },
    {
      id: 'run',
      label: 'Workflow run',
      value: 'No run in this build',
      source: 'unavailable',
      observedAt: null,
    },
  ];
}
