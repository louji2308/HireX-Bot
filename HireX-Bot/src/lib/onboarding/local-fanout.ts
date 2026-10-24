import {
  answerValue,
  deriveIntakeDiagnostics,
  labelsForSignalValues,
} from '@/lib/onboarding/taxonomy';
import type { IntakeSession } from '@/types/phase4_contracts';

export interface LocalFanOutCard {
  readonly lane: 'discovery' | 'application_prep' | 'training';
  readonly title: string;
  readonly status: 'preview';
  readonly summary: string;
  readonly nextAction: string;
}

export function buildLocalFanOutPreview(session: IntakeSession): LocalFanOutCard[] {
  const roleValues = answerValue(session, 1);
  const roles = Array.isArray(roleValues)
    ? labelsForSignalValues(1, roleValues)
    : [];
  const roleText = roles.length > 0 ? roles.join(', ') : 'your selected roles';
  const diagnostics = deriveIntakeDiagnostics(session);
  const extractedFields =
    session.extraction?.fields.filter((field) => field.status !== 'missing').length ?? 0;

  const discoverySummary =
    diagnostics.bottleneck
      ? `Start with ${roleText}, but prioritise proof repair before volume.`
      : `Start with ${roleText} and rank every role against your stated constraints.`;

  const prepSummary =
    extractedFields > 0
      ? `${String(extractedFields)} resume fields are available for review. Confirm them before any document is drafted.`
      : 'No resume fields were extracted. Add evidence before a truthful document can be drafted.';

  const trainingSummary = diagnostics.freeOnly
    ? 'Use zero-cost practice only. No paid course or provider is connected.'
    : 'Practice is a baseline check, not an employer certification.';

  return [
    {
      lane: 'discovery',
      title: 'Discovery preview',
      status: 'preview',
      summary: discoverySummary,
      nextAction: 'Review real opportunities when the discovery source is connected.',
    },
    {
      lane: 'application_prep',
      title: 'Application preparation preview',
      status: 'preview',
      summary: prepSummary,
      nextAction: 'Confirm each extracted fact before generating a resume or outreach draft.',
    },
    {
      lane: 'training',
      title: 'Training preview',
      status: 'preview',
      summary: trainingSummary,
      nextAction: 'Use the practice probe as a confidence check, then choose one bounded exercise.',
    },
  ];
}
