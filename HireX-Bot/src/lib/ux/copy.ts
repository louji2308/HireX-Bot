import type { NavTabId } from '@/types/phase3_contracts';

export const WORKSPACE_EYEBROW = 'HireX Bot · Workspace';
export const NOT_CONNECTED_LABEL = 'Not connected yet';

export const WORKSPACE_COPY: Record<
  NavTabId,
  {
    readonly title: string;
    readonly description: string;
    readonly sectionLabel: string;
    readonly items: readonly string[];
    readonly closing: string;
  }
> = {
  command: {
    title: 'Your next move, in one place.',
    description:
      'Discovery, proof-building, and company-calibrated practice are designed to move in parallel. This workspace will show what is current, what is waiting on you, and what to do next.',
    sectionLabel: 'What this workspace will hold',
    items: [
      'Opportunity matches with their source and confidence',
      'A proof task tied to a real role, not a generic course',
      'Approval requests that wait for your explicit decision',
    ],
    closing: 'No workflow activity yet. The pulse strip fills only when real workflows begin.',
  },
  opportunities: {
    title: 'Roles you can inspect before applying.',
    description:
      'Each opportunity will show the evidence behind its fit assessment, the skills it asks for, and the next useful step. Missing evidence will be reported as missing, not as a lack of ability.',
    sectionLabel: 'What this workspace will hold',
    items: [
      'Real postings with source and retrieval date',
      'Five independent fit dimensions with explanations',
      'A clear route: apply, prepare, build proof, or skip',
    ],
    closing: 'Opportunity discovery is not connected in this build.',
  },
  studio: {
    title: 'Practice against the company context.',
    description:
      'Interview blueprints will separate confirmed company requirements from inferred ones. Practice sessions will keep their rubric version and history so progress stays comparable.',
    sectionLabel: 'What this workspace will hold',
    items: [
      'Company-specific blueprints with evidence tiers',
      'Calibrated practice rounds and saved attempts',
      'Feedback tied to the rubric that produced it',
    ],
    closing: 'The practice studio is not connected in this build.',
  },
  proof: {
    title: 'Evidence from work you actually did.',
    description:
      'Repository audits and apprenticeship sprints will turn real contributions into reviewable proof. Every claim will link back to the artifact that supports it.',
    sectionLabel: 'What this workspace will hold',
    items: [
      'Repository audits with concrete upgrade tasks',
      'Time-bounded apprenticeship sprints',
      'Pre-PR checks and human-reviewed contributions',
    ],
    closing: 'Proof-of-work auditing is not connected in this build.',
  },
  passport: {
    title: 'A record you control and can explain.',
    description:
      'Your passport will hold evidence-bearing claims with provenance. Public views will stay read-only and limited to the fields you approve.',
    sectionLabel: 'What this workspace will hold',
    items: [
      'Verified skills linked to supporting artifacts',
      'Rubric and evaluation provenance for every result',
      'Explicit control over what an employer can inspect',
    ],
    closing: 'Passport issuance is not connected in this build.',
  },
};

export const COPY_GUARDRAIL_FORBIDDEN_TERMS = [
  'Rejected',
  'Weak',
  'Failed',
  'Ineligible',
  'Unskilled',
  'Probability of Passing',
  'Mandatory Anti-Cheating Test',
] as const;

export function findForbiddenCopyTerms(text: string): string[] {
  const normalized = text.toLocaleLowerCase('en-IN');
  return COPY_GUARDRAIL_FORBIDDEN_TERMS.filter((term) =>
    normalized.includes(term.toLocaleLowerCase('en-IN')),
  );
}
