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
