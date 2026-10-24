/**
 * Phase 4 frozen contracts (PHASE4_CONTRACT.md, Build Plan Phase 4).
 *
 * Scope: local-first Module 1 intake, the 34-signal taxonomy, deterministic
 * extraction/probe results, append-only consent, and local persistence.
 *
 * This file is write-frozen for the Phase 4 coding wave. Changes require an
 * evidence-backed contract amendment.
 */

import type { CandidateOnboardingCompletedPayload } from '@/types/phase3_contracts';

export const PHASE4_CONTRACT_VERSION = 'phase4.intake.v1' as const;
export const PHASE4_TAXONOMY_VERSION = '34-signal.v1' as const;
export const PHASE4_NOTICE_VERSION = 'dpdp-notice.v1' as const;
export const PHASE4_MAX_TARGET_ROLES = 3 as const;
export const PHASE4_MAX_TEXT_CHARS = 100_000 as const;

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export type SignalId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
  | 31 | 32 | 33 | 34;

export type SignalChapterId =
  | 'goals'
  | 'boundaries'
  | 'profiles'
  | 'search'
  | 'interviews'
  | 'constraints'
  | 'permissions';

export interface SignalChapter {
  readonly id: SignalChapterId;
  readonly label: string;
  readonly signalIds: readonly SignalId[];
}

export const SIGNAL_CHAPTERS: readonly SignalChapter[] = [
  { id: 'goals', label: 'Goals', signalIds: [1, 2, 3, 4] },
  { id: 'boundaries', label: 'Boundaries', signalIds: [5, 6, 7, 8, 9, 10] },
  { id: 'profiles', label: 'Profiles', signalIds: [11, 12, 13, 14, 15] },
  { id: 'search', label: 'Search History', signalIds: [16, 17, 18, 19, 20] },
  { id: 'interviews', label: 'Interviews', signalIds: [21, 22, 23, 24] },
  { id: 'constraints', label: 'Constraints', signalIds: [25, 26, 27, 28, 29] },
  { id: 'permissions', label: 'Permissions', signalIds: [30, 31, 32, 33, 34] },
] as const;

export type SignalControl =
  | 'single'
  | 'multi'
  | 'boolean'
  | 'text'
  | 'url'
  | 'url_list';

export interface SignalOption {
  readonly value: string;
  readonly label: string;
}

export interface SignalDefinition {
  readonly id: SignalId;
  readonly chapter: SignalChapterId;
  readonly prompt: string;
  readonly why: string;
  readonly control: SignalControl;
  readonly required: boolean;
  readonly options?: readonly SignalOption[];
  readonly maxSelections?: number;
  readonly exclusiveOption?: string;
  readonly maxChars?: number;
  readonly extractedKeys?: readonly ExtractedFieldKey[];
  readonly allowNone?: boolean;
}

const option = (value: string, label: string): SignalOption => ({ value, label });

const TARGET_ROLES = [
  option('backend_sde', 'Backend SDE'),
  option('full_stack', 'Full-Stack'),
  option('frontend_ui', 'Frontend / UI'),
  option('data_ml', 'Data / ML Engineer'),
  option('qa_automation', 'QA & Test Automation'),
  option('devops_cloud', 'DevOps / Cloud'),
  option('mobile', 'Mobile'),
  option('open_apprenticeship', 'Open to Apprenticeships'),
] as const;

const STACK = [
  option('typescript_javascript', 'TypeScript / JavaScript'),
  option('python', 'Python'),
  option('java', 'Java'),
  option('cpp', 'C++'),
  option('csharp', 'C#'),
  option('go', 'Go'),
  option('sql', 'SQL'),
  option('react', 'React'),
  option('node', 'Node.js'),
  option('other', 'Other'),
] as const;

const INDUSTRIES = [
  option('startup', 'Startup'),
  option('sme', 'SME'),
  option('gcc', 'Global capability centre'),
  option('it_services', 'IT services'),
  option('product_enterprise', 'Product enterprise'),
  option('ngo_civic', 'NGO / civic-tech'),
  option('open_to_any', 'Open to any'),
] as const;

const LOCATIONS = [
  option('bengaluru', 'Bengaluru'),
  option('hyderabad', 'Hyderabad'),
  option('pune', 'Pune'),
  option('chennai', 'Chennai'),
  option('delhi_ncr', 'Delhi NCR'),
  option('mumbai', 'Mumbai'),
  option('remote_india', 'Remote in India'),
  option('anywhere_india', 'Anywhere in India'),
  option('other', 'Other'),
] as const;

const DIFFICULTIES = [
  option('no_callbacks', 'No callbacks after applying'),
  option('no_interviews', 'Applications never reach interviews'),
  option('fail_oas', 'Online assessments are the blocker'),
  option('fail_interviews', 'Live interviews are the blocker'),
  option('lack_portfolio', 'No portfolio or proof of work'),
  option('lack_guidance', 'No guidance on what to fix'),
  option('other', 'Something else'),
] as const;

const PENDING_OUTCOMES = [
  option('pending_applications', 'Applications still pending'),
  option('scheduled_interviews', 'Interviews scheduled'),
  option('offers', 'Offers in hand'),
  option('none', 'Nothing pending'),
] as const;

const INTERVIEW_STAGES = [
  option('oa', 'Online assessment'),
  option('technical', 'Technical interview'),
  option('managerial', 'Managerial round'),
  option('hr', 'HR round'),
  option('none_yet', "I haven't attended a live interview yet"),
] as const;

const STRUGGLED_ROUNDS = [
  option('oa', 'Online assessments'),
  option('dsa_live', 'Explaining data structures and algorithms live'),
  option('dp_graphs', 'Dynamic programming and graphs'),
  option('project_defense', 'Defending my projects'),
  option('system_design', 'System design'),
] as const;

const IMPROVEMENT_AREAS = [
  option('dsa', 'Data structures and algorithms'),
  option('projects', 'Project depth'),
  option('system_design', 'System design'),
  option('communication', 'Communication'),
  option('resume', 'Resume signalling'),
  option('domain', 'Domain knowledge'),
] as const;

const CONFIDENCE_AREAS = [
  option('dsa', 'Data structures and algorithms'),
  option('system_design', 'System design'),
  option('backend', 'Backend engineering'),
  option('frontend', 'Frontend engineering'),
  option('data_ml', 'Data / ML'),
  option('devops', 'DevOps / cloud'),
  option('testing', 'Testing and reliability'),
  option('communication', 'Communication'),
] as const;

const CONSTRAINTS = [
  option('mobile_only', 'Mobile-only access'),
  option('intermittent_internet', 'Intermittent internet'),
  option('regional_language', 'Regional-language preference'),
  option('work_family_schedule', 'Work or family schedule'),
  option('none', 'None of these'),
] as const;

export const SIGNAL_DEFINITIONS: readonly SignalDefinition[] = [
  {
    id: 1,
    chapter: 'goals',
    prompt: 'Which engineering roles should we actively hunt and calibrate for you right now?',
    why: 'We launch discovery when you finish. Pick up to 3 core tracks.',
    control: 'multi',
    required: true,
    options: TARGET_ROLES,
    maxSelections: PHASE4_MAX_TARGET_ROLES,
  },
  {
    id: 2,
    chapter: 'goals',
    prompt: 'Which stack do you want to be judged on?',
    why: 'This sets the language and framework context for your proof review.',
    control: 'multi',
    required: true,
    options: STACK,
    maxSelections: 6,
  },
  {
    id: 3,
    chapter: 'goals',
    prompt: 'Which kinds of companies fit how you want to start?',
    why: 'Hard preferences are respected so we do not send you a poor-fit queue.',
    control: 'multi',
    required: false,
    options: INDUSTRIES,
    maxSelections: 5,
  },
  {
    id: 4,
    chapter: 'goals',
    prompt: 'What is your main goal for the next 6 to 12 months?',
    why: 'A clear goal keeps the next action useful instead of generic.',
    control: 'single',
    required: true,
    options: [
      option('first_role', 'Land my first full-time role'),
      option('apprenticeship', 'Start with an apprenticeship'),
      option('portfolio', 'Build credible proof of work'),
      option('switch_domain', 'Move into a new domain'),
    ],
  },
  {
    id: 5,
    chapter: 'boundaries',
    prompt: 'Where can you realistically work?',
    why: 'Location is a hard boundary, not a preference we should ignore.',
    control: 'multi',
    required: true,
    options: LOCATIONS,
    maxSelections: 5,
  },
  {
    id: 6,
    chapter: 'boundaries',
    prompt: 'Which work mode works for you?',
    why: 'We filter roles by the setup you can actually accept.',
    control: 'single',
    required: true,
    options: [
      option('remote', 'Remote'),
      option('hybrid', 'Hybrid'),
      option('onsite', 'Onsite'),
      option('flexible', 'Flexible'),
    ],
  },
  {
    id: 7,
    chapter: 'boundaries',
    prompt: 'Which employment types should be considered?',
    why: 'This keeps unpaid or mislabelled roles out of your queue.',
    control: 'multi',
    required: true,
    options: [
      option('full_time', 'Full-time'),
      option('internship', 'Internship'),
      option('apprenticeship', 'Apprenticeship'),
      option('contract', 'Contract'),
    ],
    maxSelections: 4,
  },
  {
    id: 8,
    chapter: 'boundaries',
    prompt: 'What is the minimum monthly stipend or annual CTC that respects your financial reality?',
    why: 'We use this as a hard eligibility floor so we do not waste your time.',
    control: 'single',
    required: true,
    options: [
      option('credit_only', 'Academic credit only / no stipend'),
      option('10k_20k_month', 'INR 10k-20k per month'),
      option('3_5_lpa', 'INR 3.5-5 LPA'),
      option('6_10_lpa', 'INR 6-10 LPA'),
      option('10_plus_lpa', 'INR 10+ LPA'),
      option('not_sure', 'Not sure yet'),
    ],
  },
  {
    id: 9,
    chapter: 'boundaries',
    prompt: 'When could you start?',
    why: 'Joining windows prevent applications that cannot become real offers.',
    control: 'single',
    required: true,
    options: [
      option('immediately', 'Immediately'),
      option('two_weeks', 'Within 2 weeks'),
      option('one_month', 'Within 1 month'),
      option('three_months', 'Within 3 months'),
      option('six_plus_months', '6 months or later'),
    ],
  },
  {
    id: 10,
    chapter: 'boundaries',
    prompt: 'Are you willing to relocate for the right role?',
    why: 'This changes which locations and companies are realistic.',
    control: 'boolean',
    required: true,
  },
  {
    id: 11,
    chapter: 'profiles',
    prompt: 'What is your GitHub profile URL?',
    why: 'A repo is the strongest proof source we can inspect. You can say you do not have one.',
    control: 'url',
    required: true,
    allowNone: true,
    extractedKeys: ['github_url'],
  },
  {
    id: 12,
    chapter: 'profiles',
    prompt: 'Do you have a coding profile such as LeetCode, CodeChef, Codeforces or HackerRank?',
    why: 'Optional evidence can strengthen your proof, but it is not required.',
    control: 'url',
    required: false,
    allowNone: true,
  },
  {
    id: 13,
    chapter: 'profiles',
    prompt: 'Do you have a LinkedIn profile we did not find in your resume?',
    why: 'Only add it if you want it considered. Missing is not a penalty.',
    control: 'url',
    required: false,
    allowNone: true,
    extractedKeys: ['linkedin_url'],
  },
  {
    id: 14,
    chapter: 'profiles',
    prompt: 'Do you have live deployed projects or a portfolio to audit?',
    why: 'A working URL is stronger evidence than a claim on a resume.',
    control: 'url_list',
    required: false,
    maxSelections: 5,
  },
  {
    id: 15,
    chapter: 'profiles',
    prompt: 'Do you have role-specific profiles such as Kaggle, Hugging Face, Figma or Behance?',
    why: 'These are optional; add only the ones that represent your work.',
    control: 'url_list',
    required: false,
    maxSelections: 5,
  },
  {
    id: 16,
    chapter: 'search',
    prompt: 'Roughly how many off-campus applications have you sent recently?',
    why: 'This helps diagnose whether the bottleneck is signal, proof or conversion.',
    control: 'single',
    required: true,
    options: [
      option('none', "Haven't started applying yet"),
      option('1_14', '1-14 applications'),
      option('15_30', '15-30 applications'),
      option('31_plus', '31+ applications'),
    ],
  },
  {
    id: 17,
    chapter: 'search',
    prompt: 'Do those applications typically receive recruiter replies?',
    why: 'Replies tell us whether the problem is reach or conversion.',
    control: 'single',
    required: true,
    options: [
      option('yes', 'Yes, some replies'),
      option('no', 'No recruiter replies'),
      option('not_started', 'Not started yet'),
      option('not_sure', 'Not sure'),
    ],
  },
  {
    id: 18,
    chapter: 'search',
    prompt: 'What has been hardest about the search?',
    why: 'We target the real blocker instead of repeating generic advice.',
    control: 'multi',
    required: false,
    options: DIFFICULTIES,
    maxSelections: 6,
  },
  {
    id: 19,
    chapter: 'search',
    prompt: 'What rejection or recruiter feedback have you received, if any?',
    why: 'Direct feedback is useful evidence. You can skip this.',
    control: 'text',
    required: false,
    maxChars: 500,
  },
  {
    id: 20,
    chapter: 'search',
    prompt: 'What is currently pending?',
    why: 'Pending interviews change the urgency and sequencing of your next step.',
    control: 'multi',
    required: false,
    options: PENDING_OUTCOMES,
    maxSelections: 4,
  },
  {
    id: 21,
    chapter: 'interviews',
    prompt: 'Which interview stages have you attended?',
    why: 'Practice targets the stage that is actually blocking you.',
    control: 'multi',
    required: true,
    options: INTERVIEW_STAGES,
    maxSelections: 5,
    exclusiveOption: 'none_yet',
  },
  {
    id: 22,
    chapter: 'interviews',
    prompt: 'Which rounds felt hardest?',
    why: 'This seeds the first practice session instead of starting from basics.',
    control: 'multi',
    required: false,
    options: STRUGGLED_ROUNDS,
    maxSelections: 5,
  },
  {
    id: 23,
    chapter: 'interviews',
    prompt: 'What feedback did interviewers give you, if any?',
    why: 'Specific feedback is more useful than a general feeling. You can skip this.',
    control: 'text',
    required: false,
    maxChars: 500,
  },
  {
    id: 24,
    chapter: 'interviews',
    prompt: 'What do you most want to improve before your next interview?',
    why: 'This sets a focused practice goal.',
    control: 'multi',
    required: true,
    options: IMPROVEMENT_AREAS,
    maxSelections: 4,
  },
  {
    id: 25,
    chapter: 'constraints',
    prompt: 'Where is your confidence lowest right now?',
    why: 'Naming a gap is planning, not a judgement about your ability.',
    control: 'multi',
    required: true,
    options: CONFIDENCE_AREAS,
    maxSelections: 4,
  },
  {
    id: 26,
    chapter: 'constraints',
    prompt: 'Which area would you prefer to improve first?',
    why: 'Your choice keeps the plan realistic.',
    control: 'multi',
    required: false,
    options: CONFIDENCE_AREAS,
    maxSelections: 3,
  },
  {
    id: 27,
    chapter: 'constraints',
    prompt: 'How many hours per week can you realistically prepare?',
    why: 'A plan that ignores your time is not a plan.',
    control: 'single',
    required: true,
    options: [
      option('under_5', 'Under 5 hours'),
      option('5_10', '5-10 hours'),
      option('10_20', '10-20 hours'),
      option('20_plus', '20+ hours'),
    ],
  },
  {
    id: 28,
    chapter: 'constraints',
    prompt: 'Do you need learning resources to be 100% free?',
    why: 'If yes, every recommendation must stay free.',
    control: 'boolean',
    required: true,
  },
  {
    id: 29,
    chapter: 'constraints',
    prompt: 'Do any practical constraints affect how you use this workspace?',
    why: 'Low-bandwidth and language constraints change the right format.',
    control: 'multi',
    required: false,
    options: CONSTRAINTS,
    maxSelections: 4,
    exclusiveOption: 'none',
  },
  {
    id: 30,
    chapter: 'permissions',
    prompt: 'May we connect email and read relevant job-search messages?',
    why: 'This is off by default and can be revoked. It is not required to use intake.',
    control: 'boolean',
    required: true,
  },
  {
    id: 31,
    chapter: 'permissions',
    prompt: 'May we prepare recruiter outreach drafts for you?',
    why: 'Drafting is separate from sending. You stay in control.',
    control: 'boolean',
    required: false,
  },
  {
    id: 32,
    chapter: 'permissions',
    prompt: 'How should we ask before sending an email?',
    why: 'No message is sent by this local build.',
    control: 'single',
    required: true,
    options: [
      option('always_ask', 'Always ask me first'),
      option('batch_approve', 'Let me approve a batch'),
      option('never', 'Never send messages'),
    ],
  },
  {
    id: 33,
    chapter: 'permissions',
    prompt: 'How should we ask before submitting an application?',
    why: 'No application is submitted by this local build.',
    control: 'single',
    required: true,
    options: [
      option('always_ask', 'Always ask me first'),
      option('per_application', 'Approve each application individually'),
      option('never', 'Never submit applications'),
    ],
  },
  {
    id: 34,
    chapter: 'permissions',
    prompt: 'May we track applications and schedule follow-ups?',
    why: 'Tracking is optional and can be revoked.',
    control: 'boolean',
    required: false,
  },
] as const;

export const SIGNAL_BY_ID: ReadonlyMap<SignalId, SignalDefinition> = new Map(
  SIGNAL_DEFINITIONS.map((signal) => [signal.id, signal]),
);

export function getSignalDefinition(signalId: SignalId): SignalDefinition {
  const definition = SIGNAL_BY_ID.get(signalId);
  if (!definition) throw new Error(`Unknown signal: ${String(signalId)}`);
  return definition;
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

export type CollegeTier = 'Tier_1' | 'Tier_2' | 'Tier_3' | 'Rural';
export type SupportedLanguage = 'ta' | 'hi' | 'te' | 'kn' | 'bn' | 'mr' | 'en';
export type AutonomyLevel = 1 | 2 | 3 | 4;

export type ExtractedFieldKey =
  | 'full_name'
  | 'email'
  | 'phone'
  | 'college_name'
  | 'degree_stream'
  | 'graduation_year'
  | 'coursework'
  | 'internships'
  | 'skills_claimed'
  | 'projects_listed'
  | 'github_url'
  | 'linkedin_url';

export const EXTRACTED_FIELD_KEYS = [
  'full_name',
  'email',
  'phone',
  'college_name',
  'degree_stream',
  'graduation_year',
  'coursework',
  'internships',
  'skills_claimed',
  'projects_listed',
  'github_url',
  'linkedin_url',
] as const satisfies readonly ExtractedFieldKey[];

export type ExtractedFieldStatus = 'confirmed' | 'inferred' | 'missing';
export type ExtractionStatus = 'ok' | 'partial' | 'needs_text_fallback' | 'failed';

export interface ExtractedField {
  readonly key: ExtractedFieldKey;
  readonly label: string;
  readonly value: string | string[] | number | null;
  readonly status: ExtractedFieldStatus;
  readonly confidence: number;
  readonly source: 'resume_text' | 'user';
  readonly note: string | null;
}

export interface ExtractionResult {
  readonly provider: 'local_deterministic_text';
  readonly providerVersion: 'phase4.local-text.v1';
  readonly status: ExtractionStatus;
  readonly fields: readonly ExtractedField[];
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
  readonly sourceName: string | null;
  readonly rawTextStored: false;
}

/* ------------------------------------------------------------------ */
/* Session, answers, consent and probe                                 */
/* ------------------------------------------------------------------ */

export type SignalValue = string | readonly string[] | boolean | null;

export interface SignalAnswer {
  readonly signalId: SignalId;
  readonly value: SignalValue;
  readonly answeredAt: string;
  readonly revision: number;
}

export type SignalStatus =
  | 'answered'
  | 'skipped_extracted'
  | 'skipped_conditional'
  | 'skipped_optional'
  | 'unanswered';

export interface ConsentEntry {
  readonly entryId: string;
  readonly signalId: 30 | 31 | 32 | 33 | 34;
  readonly purpose: string;
  readonly scopes: readonly string[];
  readonly granted: boolean;
  readonly at: string;
  readonly actor: 'candidate_local';
}

export interface ConsentLedger {
  readonly noticeVersion: typeof PHASE4_NOTICE_VERSION;
  readonly acknowledgedAt: string | null;
  readonly entries: readonly ConsentEntry[];
}

export type ProbeLanguage = 'typescript' | 'python' | 'java';
export type ProbeSource = 'generic_fallback' | 'repo_excerpt';

export interface ProbeResult {
  readonly status: 'completed' | 'skipped';
  readonly language: ProbeLanguage;
  readonly snippetId: string;
  readonly source: ProbeSource;
  readonly mcqChoice: string | null;
  readonly explanation: string;
  readonly score: number | null;
  readonly scoreMethod: 'deterministic_keyword' | 'not_scored';
  readonly verification: 'practice_baseline';
  readonly completedAt: string;
}

export interface WorkspaceProfile {
  readonly collegeTier: CollegeTier | null;
  readonly preferredLanguage: SupportedLanguage;
  readonly autonomyLevel: AutonomyLevel;
}

export interface LocalFanOutResult {
  readonly durable: false;
  readonly source: 'local_preview';
  readonly lanes: readonly ['discovery', 'application_prep', 'training'];
}

export interface CompletionRecord {
  readonly eventId: string;
  readonly completedAt: string;
  readonly payload: CandidateOnboardingCompletedPayload;
  readonly fanOut: LocalFanOutResult;
}

export interface IntakeSession {
  readonly version: 1;
  readonly contractVersion: typeof PHASE4_CONTRACT_VERSION;
  readonly taxonomyVersion: typeof PHASE4_TAXONOMY_VERSION;
  readonly sessionId: string;
  readonly candidateId: string;
  readonly mode: 'local_draft';
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly extraction: ExtractionResult | null;
  readonly extractionReviewedAt: string | null;
  readonly profile: WorkspaceProfile;
  readonly signals: Readonly<Record<string, SignalAnswer>>;
  readonly consent: ConsentLedger;
  readonly probe: ProbeResult | null;
  readonly completion: CompletionRecord | null;
}

/* ------------------------------------------------------------------ */
/* Persistence port                                                    */
/* ------------------------------------------------------------------ */

export type IntakeStoreStatus = 'applied' | 'conflict' | 'not_found';

export interface IntakeStoreUpdate {
  readonly status: IntakeStoreStatus;
  readonly session: IntakeSession | null;
}

export interface IntakeStore {
  /** False until a durable authenticated adapter exists. Never claim durability. */
  readonly durable: boolean;
  create(seed?: Partial<Pick<IntakeSession, 'candidateId' | 'createdAt'>>): Promise<IntakeSession>;
  read(sessionId: string): Promise<IntakeSession | null>;
  update(
    sessionId: string,
    expectedRevision: number,
    updater: (current: IntakeSession) => IntakeSession,
  ): Promise<IntakeStoreUpdate>;
  erase(sessionId: string): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* Diagnostics and mutation results                                    */
/* ------------------------------------------------------------------ */

export interface IntakeDiagnostics {
  readonly bottleneck: boolean;
  readonly freeOnly: boolean;
  readonly reasons: readonly string[];
}

export type IntakeMutationCode =
  | 'INVALID_SIGNAL'
  | 'INVALID_VALUE'
  | 'SIGNAL_ALREADY_ANSWERED'
  | 'SIGNAL_REQUIRED'
  | 'NO_SESSION'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'INVALID_EXTRACTION'
  | 'NO_PROGRESS';

export interface IntakeMutationResult {
  readonly status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  readonly session: IntakeSession | null;
  readonly code?: IntakeMutationCode;
}
