import {
  canComplete,
  unansweredRequiredSignals,
} from '@/lib/onboarding/intake-machine';
import {
  chapterProgress,
  deriveIntakeDiagnostics,
  nextSignalId,
} from '@/lib/onboarding/taxonomy';
import type { IntakeSession } from '@/types/phase4_contracts';

export function sessionView(session: IntakeSession) {
  return {
    session,
    nextSignalId: nextSignalId(session),
    chapterProgress: chapterProgress(session),
    diagnostics: deriveIntakeDiagnostics(session),
    canComplete: canComplete(session),
    unresolvedRequiredSignals: unansweredRequiredSignals(session),
  };
}
