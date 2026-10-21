/**
 * Minimal Mixture-of-Agents debate orchestrator (Build Plan.md Step 1.4,
 * `Coder-Swarm`).
 *
 * The Build Plan names LangGraph. LangGraph is a Python runtime and this project
 * is a TypeScript/Next.js deployment with a zero-dollar infrastructure budget,
 * so the *contract* is implemented here in TypeScript instead: every participant
 * submits an independent proposal before seeing anyone else's, proposals are
 * cross-critiqued, and a single arbiter records the decision, rejected
 * alternatives and unresolved dissent.
 *
 * What this module will not do:
 *  - run proposals concurrently with critique, which would anchor the critics;
 *  - accept a proposal with no evidence, no alternative, or no stated risk;
 *  - report consensus as a decision when the arbiter has not decided.
 */

export interface DebateQuestion {
  readonly id: string;
  readonly question: string;
  /** Source clauses, file paths or measurements the debate is bound to. */
  readonly constraints: readonly string[];
}

export interface Proposal {
  readonly role: string;
  readonly decision: string;
  readonly rationale: string;
  readonly evidence: readonly string[];
  /** At least one plausible alternative is mandatory (AGENTS.md §5.2). */
  readonly alternatives: readonly string[];
  readonly risks: readonly string[];
  readonly confidence: number;
  readonly testableClaim: string;
}

export interface Critique {
  readonly role: string;
  readonly targetRole: string;
  readonly objection: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface Arbitration {
  readonly decision: string;
  readonly rationale: string;
  readonly rejected: readonly { readonly role: string; readonly reason: string }[];
  readonly dissent: readonly string[];
}

export interface DebateParticipant {
  readonly role: string;
  readonly label: string;
  propose(input: ProposalInput): Promise<Proposal>;
  critique?(input: CritiqueInput): Promise<readonly Critique[]>;
}

export interface ProposalInput {
  readonly phase: number;
  readonly question: DebateQuestion;
}

export interface CritiqueInput extends ProposalInput {
  readonly proposals: readonly Proposal[];
}

export interface ArbitrationInput extends ProposalInput {
  readonly proposals: readonly Proposal[];
  readonly critiques: readonly Critique[];
}

export interface DebateClock {
  now(): number;
}

export interface RunDebateOptions {
  readonly phase: number;
  readonly question: DebateQuestion;
  readonly participants: readonly DebateParticipant[];
  readonly arbitrate: (input: ArbitrationInput) => Promise<Arbitration>;
  readonly clock?: DebateClock;
}

export interface DebateResult {
  readonly questionId: string;
  readonly phase: number;
  readonly proposals: readonly Proposal[];
  readonly critiques: readonly Critique[];
  readonly arbitration: Arbitration;
  readonly dissentPreserved: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
}

export type OrchestratorErrorCode = 'NO_PARTICIPANTS' | 'INVALID_PROPOSAL' | 'PARTICIPANT_FAILED';

export class OrchestratorError extends Error {
  readonly code: OrchestratorErrorCode;
  readonly role: string | null;

  constructor(code: OrchestratorErrorCode, message: string, role: string | null = null) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.role = role;
  }
}

function assertProposal(proposal: Proposal): void {
  const problems: string[] = [];
  if (!proposal.role.trim()) problems.push('role is empty');
  if (!proposal.decision.trim()) problems.push('decision is empty');
  if (!proposal.rationale.trim()) problems.push('rationale is empty');
  if (proposal.evidence.length === 0) problems.push('no evidence supplied');
  if (proposal.alternatives.length === 0) problems.push('no alternative considered');
  if (proposal.risks.length === 0) problems.push('no risk stated');
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1) {
    problems.push('confidence must be within [0, 1]');
  }
  if (!proposal.testableClaim.trim()) problems.push('no testable claim supplied');

  if (problems.length > 0) {
    throw new OrchestratorError(
      'INVALID_PROPOSAL',
      `Proposal from "${proposal.role}" is unusable: ${problems.join('; ')}.`,
      proposal.role,
    );
  }
}

function assertUniqueRoles(participants: readonly DebateParticipant[]): void {
  const seen = new Set<string>();
  for (const participant of participants) {
    if (seen.has(participant.role)) {
      throw new OrchestratorError(
        'NO_PARTICIPANTS',
        `Participant role "${participant.role}" appears twice; findings would be double-counted.`,
        participant.role,
      );
    }
    seen.add(participant.role);
  }
}

export async function runDebate(options: RunDebateOptions): Promise<DebateResult> {
  if (options.participants.length === 0) {
    throw new OrchestratorError('NO_PARTICIPANTS', 'A debate needs at least one participant.');
  }
  assertUniqueRoles(options.participants);

  const clock: DebateClock = options.clock ?? { now: () => Date.now() };
  const startedMs = clock.now();
  const input: ProposalInput = { phase: options.phase, question: options.question };

  // Phase 1: independent proposals. Never shown to each other before this settles.
  const proposals: Proposal[] = [];
  for (const participant of options.participants) {
    let proposal: Proposal;
    try {
      proposal = await participant.propose(input);
    } catch (error) {
      throw new OrchestratorError(
        'PARTICIPANT_FAILED',
        `Participant "${participant.role}" failed to propose: ${
          error instanceof Error ? error.message : 'unknown error'
        }.`,
        participant.role,
      );
    }
    assertProposal(proposal);
    if (proposal.role !== participant.role) {
      throw new OrchestratorError(
        'INVALID_PROPOSAL',
        `Participant "${participant.role}" returned a proposal attributed to "${proposal.role}".`,
        participant.role,
      );
    }
    proposals.push(proposal);
  }

  // Phase 2: cross-critique with the full proposal set visible.
  const critiques: Critique[] = [];
  for (const participant of options.participants) {
    if (!participant.critique) continue;
    const produced = await participant.critique({ ...input, proposals });
    for (const critique of produced) {
      if (!critique.objection.trim()) continue;
      const targetExists = proposals.some((proposal) => proposal.role === critique.targetRole);
      if (!targetExists) {
        throw new OrchestratorError(
          'INVALID_PROPOSAL',
          `Critique from "${critique.role}" targets unknown role "${critique.targetRole}".`,
          critique.role,
        );
      }
      critiques.push({ ...critique, role: participant.role });
    }
  }

  const arbitration = await options.arbitrate({ ...input, proposals, critiques });
  if (!arbitration.decision.trim() || !arbitration.rationale.trim()) {
    throw new OrchestratorError(
      'INVALID_PROPOSAL',
      'The arbiter returned a decision without a decision text or rationale.',
    );
  }

  const finishedMs = clock.now();

  return {
    questionId: options.question.id,
    phase: options.phase,
    proposals,
    critiques,
    arbitration,
    dissentPreserved: arbitration.dissent.length > 0,
    startedAt: new Date(startedMs).toISOString(),
    finishedAt: new Date(finishedMs).toISOString(),
    durationMs: finishedMs - startedMs,
  };
}
