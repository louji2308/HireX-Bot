import {
  PHASE5_QUALITY_RULES_VERSION,
  type OpportunityQualityFinding,
  type OpportunityQualityResult,
} from '@/types/phase5_contracts';

interface QualityRule {
  readonly id: string;
  readonly severity: 'medium' | 'high';
  readonly label: string;
  readonly patterns: readonly RegExp[];
}

const RULES: readonly QualityRule[] = [
  {
    id: 'training_fee',
    severity: 'high',
    label: 'Training fee',
    patterns: [
      /\btraining\s+(?:fee|fees|charges?|cost)\b/iu,
      /\b(?:registration|onboarding|joining|placement|application|course)\s+(?:fee|fees|charges?)\b/iu,
      /\bcharge\s+(?:a\s+)?(?:fee|fees)\b/iu,
      /प्रशिक्षण\s+शुल्क/u,
      /पंजीकरण\s+शुल्क/u,
    ],
  },
  {
    id: 'security_deposit',
    severity: 'high',
    label: 'Security or refundable deposit',
    patterns: [
      /\bsecurity\s+deposit\b/iu,
      /\brefundable\s+deposit\b/iu,
      /\b(?:pay|payment)\s+(?:us|for|to)\s+(?:a\s+)?(?:job|placement|training|internship)\b/iu,
      /(?:₹|rs\.?|inr)\s*\d[\d,]*\s*(?:as\s+)?(?:training|registration|security|placement|deposit)/iu,
      /जमा\s+राशि/u,
      /सुरक्षा\s+जमा/u,
    ],
  },
  {
    id: 'ambiguous_fee',
    severity: 'medium',
    label: 'Fee needs a human check',
    patterns: [/\bfees?\b/iu],
  },
  {
    id: 'bond_or_service_agreement',
    severity: 'medium',
    label: 'Bond or service agreement',
    patterns: [
      /\bbond\b/iu,
      /\bservice\s+agreement\b/iu,
      /\bminimum\s+service\s+period\b/iu,
      /\btraining\s+agreement\b/iu,
      /\bnotice\s+period\s+recovery\b/iu,
      /\bliquidated\s+damages?\b/iu,
      /\bpenalty\b/iu,
      /सेवा\s+बॉन्ड/u,
      /बॉन्ड/u,
    ],
  },
];

function scrubControls(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clauseBefore(text: string, index: number): string {
  const window = text.slice(Math.max(0, index - 72), index);
  return (window.split(/[.!?;]\s/).pop() ?? window).toLowerCase();
}

function clauseAfter(text: string, index: number): string {
  const window = text.slice(index, Math.min(text.length, index + 72));
  return (window.split(/[.!?;]\s/)[0] ?? window).toLowerCase();
}

function isNegated(text: string, start: number, end: number): boolean {
  const before = clauseBefore(text, start);
  const after = clauseAfter(text, end);
  const beforeNegated =
    /\b(?:no|not|never|without|zero|n't|free\s+of|does\s+not|do\s+not|did\s+not)\b/.test(before) ||
    /(?:नहीं|बिना|कोई\s+नहीं)/u.test(before);
  const afterNegated =
    /\b(?:not\s+required|not\s+applicable|waived|reimbursed|refunded|free|nil|zero)\b/.test(after) ||
    /(?:नहीं|माफ|वापस)/u.test(after);
  return beforeNegated || afterNegated;
}

function quoteFor(text: string, start: number, end: number): string {
  const raw = text.slice(Math.max(0, start - 64), Math.min(text.length, end + 64));
  return raw
    .replace(/https?:\/\/\S+/giu, '[link]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '[contact removed]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, '[number removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function scanRule(text: string, rule: QualityRule): OpportunityQualityFinding | null {
  for (const pattern of rule.patterns) {
    const expression = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (!isNegated(text, start, end)) {
        return {
          rule_id: rule.id,
          severity: rule.severity,
          label: rule.label,
          quote: quoteFor(text, start, end),
        };
      }
      if (expression.lastIndex === start) expression.lastIndex += 1;
    }
  }
  return null;
}

export function scanOpportunityQuality(qualityExcerpt: string): OpportunityQualityResult {
  const text = scrubControls(qualityExcerpt);
  const findings: OpportunityQualityFinding[] = [];

  for (const rule of RULES) {
    const finding = scanRule(text, rule);
    if (finding) findings.push(finding);
  }

  const hasHigh = findings.some((finding) => finding.severity === 'high');
  const hasMedium = findings.some((finding) => finding.severity === 'medium');
  const status = hasHigh ? 'fail' : hasMedium ? 'needs_review' : 'pass';
  const note =
    status === 'fail'
      ? 'A fee or deposit phrase was found in the captured excerpt. This is a text check, not a safety verification.'
      : status === 'needs_review'
        ? 'A bond or service-agreement phrase needs a human check. This is a text check, not a safety verification.'
        : 'No fee, deposit, or bond phrase was found in the captured excerpt. This is a text check, not a safety verification.';

  return {
    status,
    rules_version: PHASE5_QUALITY_RULES_VERSION,
    scanned_chars: text.length,
    findings,
    note,
  };
}
