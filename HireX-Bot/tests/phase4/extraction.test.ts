import { describe, expect, it } from 'vitest';

import {
  extractResumeText,
  isSupportedTextFile,
  unsupportedFileMessage,
} from '@/lib/onboarding/extraction';
import { SYNTHETIC_SAMPLE_RESUME } from '@/lib/onboarding/sample-resume';
import { PHASE4_MAX_TEXT_CHARS } from '@/types/phase4_contracts';

describe('Phase 4 deterministic text extraction', () => {
  it('extracts supported fields without storing raw text', () => {
    const result = extractResumeText({
      text: SYNTHETIC_SAMPLE_RESUME,
      sourceName: 'synthetic-sample.txt',
    });

    expect(result.provider).toBe('local_deterministic_text');
    expect(result.providerVersion).toBe('phase4.local-text.v1');
    expect(result.sourceName).toBe('synthetic-sample.txt');
    expect(result.rawTextStored).toBe(false);
    expect(result.status).toBe('ok');

    const byKey = Object.fromEntries(result.fields.map((field) => [field.key, field]));
    expect(byKey.full_name?.value).toBe('Sample Candidate');
    expect(byKey.email?.value).toBe('sample.candidate@example.com');
    expect(byKey.phone?.value).toContain('9000000000');
    expect(byKey.college_name?.value).toContain('Sample Institute of Technology');
    expect(byKey.github_url?.value).toContain('github.com/example-synthetic');
    expect(byKey.skills_claimed?.value).toContain('TypeScript');
  });

  it('marks a field as missing rather than inventing a value', () => {
    const result = extractResumeText({ text: 'A short note about a project and nothing else.' });
    const email = result.fields.find((field) => field.key === 'email');
    expect(email).toMatchObject({ value: null, status: 'missing', confidence: 0 });
  });

  it('bounds oversized input and reports the truncation', () => {
    const result = extractResumeText({ text: 'a'.repeat(PHASE4_MAX_TEXT_CHARS + 50) });
    expect(result.warnings.some((warning) => warning.includes('first'))).toBe(true);
  });

  it('sanitizes the source name and does not accept a path', () => {
    const result = extractResumeText({
      text: 'Sample Candidate\nsample@example.com',
      sourceName: '../../private/<script>.txt',
    });
    expect(result.sourceName).toBe('script.txt');
  });

  it('rejects unsupported file types with honest copy', () => {
    expect(isSupportedTextFile('resume.txt')).toBe(true);
    expect(isSupportedTextFile('resume.md')).toBe(true);
    expect(isSupportedTextFile('resume.pdf')).toBe(false);
    expect(unsupportedFileMessage('resume.pdf')).toContain('IBM Docling');
    expect(unsupportedFileMessage('resume.docx')).toContain('Copy the resume text');
    expect(unsupportedFileMessage('resume.png')).toContain('.txt');
  });
});
