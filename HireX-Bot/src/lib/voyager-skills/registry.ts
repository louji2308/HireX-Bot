/**
 * Voyager skill registry (Build Plan.md Step 1.4/1.5).
 *
 * A skill is promoted only after its module has a passing regression test, and
 * the registry records which test proves it. This file is data plus a lookup —
 * it deliberately contains no filesystem access, so it can be imported by a
 * route handler without pulling `node:fs` into a client bundle. Artifact
 * existence is checked by `verifySkillArtifacts` with an injected predicate.
 */

export const VOYAGER_SKILL_IDS = [
  'skill:untrusted-envelope-v1',
  'skill:smart-code-router-v1',
  'skill:piston-polyglot-runner-v1',
  'skill:supabase-rls-client-v1',
  'skill:episodic-memory-consolidator-v1',
  'skill:dpdp-cascade-eraser-v1',
  'skill:inngest-6state-guard-v1',
  'skill:monochrome-pill-primitives-v1',
  'skill:judge-xray-telemetry-v1',
] as const;

export type VoyagerSkillId = (typeof VOYAGER_SKILL_IDS)[number];

export interface SkillArtifacts {
  /** The promoted implementation, relative to the repository root. */
  readonly modulePath: string;
  /** The test that must keep passing for the skill to stay promoted. */
  readonly testPath: string;
  /** Additional suites that also guard the skill. */
  readonly supportingTests?: readonly string[];
}

export interface VoyagerSkill {
  readonly id: VoyagerSkillId;
  readonly version: 1;
  readonly name: string;
  readonly phase: number;
  readonly summary: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly securityNotes: readonly string[];
  readonly artifacts: SkillArtifacts;
  readonly promotedAt: string;
}

export const VOYAGER_SKILLS: readonly VoyagerSkill[] = [
  {
    id: 'skill:untrusted-envelope-v1',
    version: 1,
    name: 'Untrusted data envelope',
    phase: 1,
    summary:
      'Normalises, decodes, strips delimiters, escapes and digests external text so it can enter a prompt as data without breaking out of the envelope.',
    inputs: ['input: string', 'source: string'],
    outputs: ['envelope: string', 'digest: sha256 hex'],
    securityNotes: [
      'Decode entities and percent-encoding before stripping closing delimiters.',
      'Escapes every angle bracket in the body, so nested payloads cannot close the block.',
      'Rejects payloads above 1,000,000 bytes instead of truncating them silently.',
    ],
    artifacts: {
      modulePath: 'src/lib/security/untrusted-envelope.ts',
      testPath: 'tests/bootstrap/untrusted-envelope.test.ts',
    },
    promotedAt: '2026-10-21T00:00:00.000Z',
  },
  {
    id: 'skill:smart-code-router-v1',
    version: 1,
    name: 'SMART-Code dual-lab router',
    phase: 1,
    summary:
      'Routes each task class to a deterministic primary lab, fails over across labs on 429, backs off within a lab on 5xx, repairs one malformed schema reply, and never returns a success without evidence.',
    inputs: ['RouteRequest', 'RouterDeps (clock, transport, budget, prompts, envelope)'],
    outputs: ['RouteSuccess with evidence', 'RouteFailure without output'],
    securityNotes: [
      'Certifiable task classes can never resolve to local inference.',
      'Failures carry no output field, so a degraded result cannot be shown as an assessment.',
      'The untrusted digest and prompt hash are attached to every success for audit.',
    ],
    artifacts: {
      modulePath: 'src/agents/router.ts',
      testPath: 'tests/phase1/smart-code-router.test.ts',
    },
    promotedAt: '2026-10-21T00:00:00.000Z',
  },
  {
    id: 'skill:piston-polyglot-runner-v1',
    version: 1,
    name: 'Piston execution client',
    phase: 1,
    summary:
      'Executes candidate code in an isolated runtime and distinguishes a passing run, a candidate error, a limit kill, an unauthorised executor and an infrastructure outage.',
    inputs: ['ExecuteRequest (language, source, limits)'],
    outputs: ['PistonOutcome (passed | compile_error | runtime_error | limit kills | infra outcomes)'],
    securityNotes: [
      'Sends an explicit CPU, wall-clock and memory limit with every request.',
      'A memory-limit kill is reported as a limit kill, never as a candidate bug.',
      'An unreachable or unauthorised executor is reported as such and never as a failed submission.',
    ],
    artifacts: {
      modulePath: 'src/lib/piston/client.ts',
      testPath: 'tests/phase1/piston-client.test.ts',
      supportingTests: ['tests/integration/piston-live.test.ts'],
    },
    promotedAt: '2026-10-21T14:25:00.000Z',
  },
  {
    id: 'skill:supabase-rls-client-v1',
    version: 1,
    name: 'RLS-scoped Supabase client',
    phase: 2,
    summary:
      'Creates user-scoped and service-role clients from lazy configuration, forwards the caller token, and never lets a browser session read the ciphertext vault.',
    inputs: ['accessToken', 'SupabaseConfig (url, anonKey, serviceRoleKey)'],
    outputs: ['SupabaseClient<Database>', 'SupabaseUnavailableError when unconfigured'],
    securityNotes: [
      'Authorization is enforced by RLS plus SECURITY DEFINER RPCs, never by hiding a UI control.',
      'The service-role client is server-only and never imported into client components.',
      'Authenticated column grants exclude oauth_token_vault.',
    ],
    artifacts: {
      modulePath: 'src/lib/supabase/server.ts',
      testPath: 'tests/phase2/privilege-matrix.test.ts',
      supportingTests: ['tests/phase2/rls-isolation.test.ts'],
    },
    promotedAt: '2026-10-21T16:00:00.000Z',
  },
  {
    id: 'skill:episodic-memory-consolidator-v1',
    version: 1,
    name: 'Deterministic episodic consolidator',
    phase: 2,
    summary:
      'Turns stored session responses into hash-provenanced memory facts, skips missing or unsafe scores, refuses to re-add facts after erasure, and keeps exactly one tombstone.',
    inputs: ['ConsolidationInput', 'ConsolidatedFact[]'],
    outputs: ['ConsolidatedFact[]', 'ErasureTombstone', 'AppendOutcome'],
    securityNotes: [
      'Stores SHA-256 digests of source prose instead of the prose itself.',
      'Rejects criterion labels outside a narrow grammar and unknown round types.',
      'Erasure tombstones block later re-consolidation for that candidate.',
    ],
    artifacts: {
      modulePath: 'src/lib/memory/consolidator.ts',
      testPath: 'tests/phase2/memory-consolidator.test.ts',
    },
    promotedAt: '2026-10-21T16:00:00.000Z',
  },
  {
    id: 'skill:dpdp-cascade-eraser-v1',
    version: 1,
    name: 'DPDP cascade eraser',
    phase: 2,
    summary:
      'Revokes provider grants, deletes database rows, purges memory and storage, deletes the auth identity, and records a truthful partial-or-complete receipt without personal data.',
    inputs: ['bearer token', 'EraseDependencies'],
    outputs: ['HTTP receipt', 'ErasureReceipt (PII-free)'],
    securityNotes: [
      'Every stage runs even when one fails; the receipt reports partial instead of success.',
      'OAuth revocation happens before the vault row is deleted.',
      'Receipts contain only a salted candidate reference and aggregate counts.',
    ],
    artifacts: {
      modulePath: 'src/lib/supabase/erase-handler.ts',
      testPath: 'tests/phase2/erase-route.test.ts',
      supportingTests: [
        'tests/phase2/dpdp-cascade.test.ts',
        'tests/phase2/token-vault.test.ts',
        'tests/phase2/revocation-storage.test.ts',
      ],
    },
    promotedAt: '2026-10-21T16:00:00.000Z',
  },
  {
    id: 'skill:inngest-6state-guard-v1',
    version: 1,
    name: 'Inngest six-state approval guard',
    phase: 3,
    summary:
      'Applies the frozen six-state workflow with optimistic versions, duplicate suppression, an audit chain, a user-input request identity, and a side-effect guard that requires recorded approval.',
    inputs: ['WorkflowTransitionRequest', 'WorkflowTaskSnapshot'],
    outputs: ['WorkflowApplyResult', 'WorkflowAuditRecord[]', 'ApprovalResolution'],
    securityNotes: [
      'A side-effecting completion is rejected unless the task previously recorded approval.',
      'A manual retry is rejected after a side effect so an external action cannot repeat.',
      'A requires_user_input transition must carry the request id that a later response has to match.',
    ],
    artifacts: {
      modulePath: 'src/inngest/task-state-store.ts',
      testPath: 'tests/phase3/state-machine.test.ts',
      supportingTests: [
        'tests/phase3/event-contracts.test.ts',
        'tests/phase3/durable-waits.test.ts',
      ],
    },
    promotedAt: '2026-10-22T00:00:00.000Z',
  },
  {
    id: 'skill:monochrome-pill-primitives-v1',
    version: 1,
    name: 'Monochrome floating pill primitives',
    phase: 3,
    summary:
      'Renders the five-tab floating pill navigation and focus strip with hollow icons, a single active pill, truthful chrome resolution, and accessible labels for icon-only tabs.',
    inputs: ['activeTabId', 'resolved workspace chrome'],
    outputs: ['navigation markup', 'focus-strip markup'],
    securityNotes: [
      'Each destination is a real link and the active tab is exposed with aria-current.',
      'Icon-only tabs keep an accessible label instead of relying on the tooltip.',
      'Focus mode removes the five-tab pill rather than hiding it visually.',
    ],
    artifacts: {
      modulePath: 'src/components/navigation/FloatingPillNavView.tsx',
      testPath: 'tests/phase3/floating-pill-nav.test.tsx',
      supportingTests: ['tests/phase3/navigation.test.ts'],
    },
    promotedAt: '2026-10-22T00:00:00.000Z',
  },
  {
    id: 'skill:judge-xray-telemetry-v1',
    version: 1,
    name: 'Honest Judge X-Ray telemetry',
    phase: 3,
    summary:
      'Shows provenance and parallel-pulse state as static or unavailable instead of inventing latency, run ids, table reads or workflow counts, and only points assistive technology at a panel that exists.',
    inputs: ['provenance entries', 'initial pulse lanes'],
    outputs: ['Judge Inspector markup', 'parallel pulse markup'],
    securityNotes: [
      'No live model, latency, run id or table read is fabricated.',
      'The toggle only sets aria-controls while the panel is rendered.',
      'Pulse lanes report not started or unavailable instead of a fake zero.',
    ],
    artifacts: {
      modulePath: 'src/components/telemetry/JudgeXRayInspector.tsx',
      testPath: 'tests/phase3/xray-and-pulse.test.tsx',
    },
    promotedAt: '2026-10-22T00:00:00.000Z',
  },
];

export class VoyagerSkillRegistry {
  private readonly skills = new Map<string, VoyagerSkill>();

  constructor(skills: readonly VoyagerSkill[] = VOYAGER_SKILLS) {
    for (const skill of skills) {
      if (this.skills.has(skill.id)) {
        throw new Error(`Duplicate Voyager skill id: ${skill.id}`);
      }
      this.skills.set(skill.id, skill);
    }
  }

  get(id: string): VoyagerSkill | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): readonly VoyagerSkill[] {
    return [...this.skills.values()];
  }
}

/**
 * Returns a list of problems instead of throwing so a startup check can log
 * every missing artifact at once.
 */
export function verifySkillArtifacts(
  skills: readonly VoyagerSkill[],
  exists: (path: string) => boolean,
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    if (seen.has(skill.id)) problems.push(`${skill.id}: duplicate skill id`);
    seen.add(skill.id);

    const paths = [
      skill.artifacts.modulePath,
      skill.artifacts.testPath,
      ...(skill.artifacts.supportingTests ?? []),
    ];
    for (const path of paths) {
      if (!exists(path)) problems.push(`${skill.id}: missing artifact ${path}`);
    }
    if (!skill.securityNotes.length) problems.push(`${skill.id}: no security notes recorded`);
    if (!skill.inputs.length || !skill.outputs.length) {
      problems.push(`${skill.id}: inputs and outputs must both be documented`);
    }
  }

  return problems;
}

export const voyagerSkillRegistry = new VoyagerSkillRegistry();
