import { describe, expect, it } from 'vitest';

import { scanOpportunityQuality } from '@/agents/module4-discovery/quality-scan';

describe('Phase 5 opportunity-quality scan', () => {
  it('passes a clean excerpt without claiming verified safety', () => {
    const result = scanOpportunityQuality(
      'A six-month internship. Travel is reimbursed. Insurance is provided.',
    );
    expect(result.status).toBe('pass');
    expect(result.findings).toEqual([]);
    expect(result.note).toContain('not a safety verification');
    expect(result.note).not.toContain('Verified');
  });

  it('fails an explicit training fee', () => {
    const result = scanOpportunityQuality('A refundable training fee of INR 5,000 is required.');
    expect(result.status).toBe('fail');
    expect(result.findings.some((finding) => finding.rule_id === 'training_fee')).toBe(true);
  });

  it('fails a security deposit at high severity', () => {
    const result = scanOpportunityQuality('A security deposit of Rs. 10,000 must be paid before joining.');
    expect(result.status).toBe('fail');
    expect(result.findings.find((finding) => finding.rule_id === 'security_deposit')?.severity).toBe(
      'high',
    );
  });

  it('routes a bond to human review, not automatic failure', () => {
    const result = scanOpportunityQuality('The role includes a two-year service bond.');
    expect(result.status).toBe('needs_review');
    expect(result.findings.find((finding) => finding.rule_id === 'bond_or_service_agreement')).toBeTruthy();
  });

  it('handles negation instead of flagging a clean policy', () => {
    const result = scanOpportunityQuality(
      'There is no training fee. No bond or service agreement applies. We do not charge a fee.',
    );
    expect(result.status).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('handles zero-width and full-width evasions', () => {
    const zeroWidth = scanOpportunityQuality('A train\u200Bing fee is required.');
    expect(zeroWidth.status).toBe('fail');
    const fullWidth = scanOpportunityQuality('Ａ training fee is required.');
    expect(fullWidth.status).toBe('fail');
  });

  it('flags a Hindi training-fee phrase', () => {
    const result = scanOpportunityQuality('प्रशिक्षण शुल्क जमा करना होगा।');
    expect(result.status).toBe('fail');
  });

  it('does not flag the word coffee', () => {
    const result = scanOpportunityQuality('The office has free coffee and tea.');
    expect(result.status).toBe('pass');
  });

  it('removes contact details from a finding quote', () => {
    const result = scanOpportunityQuality(
      'Send a training fee to recruiter@example.com or call +91 98765 43210.',
    );
    expect(result.status).toBe('fail');
    const quote = result.findings[0]?.quote ?? '';
    expect(quote).not.toContain('recruiter@example.com');
    expect(quote).not.toContain('98765');
    expect(quote).toContain('[contact removed]');
  });
});
