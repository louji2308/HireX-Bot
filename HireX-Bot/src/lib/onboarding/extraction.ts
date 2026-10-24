import { basename } from 'node:path';

import {
  PHASE4_MAX_TEXT_CHARS,
  type ExtractedField,
  type ExtractedFieldKey,
  type ExtractionResult,
} from '@/types/phase4_contracts';

export interface TextExtractionInput {
  readonly text: string;
  readonly sourceName?: string | null;
  readonly elapsedMs?: number;
}

const FIELD_LABELS: Readonly<Record<ExtractedFieldKey, string>> = {
  full_name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  college_name: 'College or university',
  degree_stream: 'Degree',
  graduation_year: 'Graduation year',
  coursework: 'Coursework',
  internships: 'Internships',
  skills_claimed: 'Skills mentioned',
  projects_listed: 'Projects mentioned',
  github_url: 'GitHub',
  linkedin_url: 'LinkedIn',
};

const SKILLS = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C++',
  'C#',
  'Go',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Git',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'GCP',
  'Machine Learning',
  'Data Structures',
  'Algorithms',
] as const;

const DEGREE_PATTERN =
  /\b(B\.?\s?Tech|B\.?\s?E\.?|B\.?\s?Sc|B\.?\s?CA|M\.?\s?Tech|M\.?\s?Sc|M\.?\s?CA|Bachelor(?:'s)?|Master(?:'s)?)\b/i;
const COLLEGE_PATTERN = /\b(college|university|institute|iit|nit|iiit|bits)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+91[\s-]?)?(?:0)?[6-9]\d{9}\b/;
const GITHUB_PATTERN = /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/?/i;
const LINKEDIN_PATTERN = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_%./-]+/i;

function cleanFieldValue(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function sanitizeSourceName(sourceName: string | null | undefined): string | null {
  if (!sourceName) return null;
  const safe = cleanFieldValue(basename(sourceName)).replace(/[<>"]/g, '');
  return safe.length > 0 ? safe.slice(0, 120) : null;
}

function field(
  key: ExtractedFieldKey,
  value: string | string[] | number | null,
  status: ExtractedField['status'],
  confidence: number,
  note: string | null = null,
): ExtractedField {
  return {
    key,
    label: FIELD_LABELS[key],
    value,
    status,
    confidence,
    source: 'resume_text',
    note,
  };
}

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanFieldValue(line))
    .filter((line) => line.length > 0);
}

function findName(lines: readonly string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    if (line.length > 80 || line.includes('@') || /https?:\/\//i.test(line)) continue;
    if (/\d{4,}/.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (COLLEGE_PATTERN.test(line) || DEGREE_PATTERN.test(line)) continue;
    return line;
  }
  return null;
}

function findLine(lines: readonly string[], pattern: RegExp): string | null {
  return lines.find((line) => pattern.test(line)) ?? null;
}

function splitList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .replace(/^[^:]*:\s*/, '')
        .split(/[,;|]/)
        .map((entry) => cleanFieldValue(entry))
        .filter((entry) => entry.length > 1 && entry.length <= 80),
    ),
  ).slice(0, 12);
}

function findSkills(text: string): string[] {
  const lower = text.toLocaleLowerCase('en-IN');
  return SKILLS.filter((skill) => lower.includes(skill.toLocaleLowerCase('en-IN')));
}

function findInternships(lines: readonly string[]): string[] {
  return lines
    .filter((line) => /\bintern(ship)?\b/i.test(line))
    .map((line) => line.slice(0, 160))
    .slice(0, 6);
}

function findProjects(lines: readonly string[]): string[] {
  return lines
    .filter((line) => /\b(project|portfolio|deployed|built|case study)\b/i.test(line))
    .map((line) => line.slice(0, 160))
    .slice(0, 8);
}

function findGraduationYear(text: string): number | null {
  const years = Array.from(text.matchAll(/\b(20[2-3]\d|19[9]\d)\b/g))
    .map((match) => Number.parseInt(match[1] ?? '', 10))
    .filter((year) => Number.isFinite(year));
  if (years.length === 0) return null;
  const currentYear = new Date().getUTCFullYear();
  const future = years.filter((year) => year >= currentYear - 6 && year <= currentYear + 8);
  return future.length > 0 ? Math.max(...future) : years[years.length - 1] ?? null;
}

function confidenceFor(status: ExtractedField['status']): number {
  if (status === 'confirmed') return 0.95;
  return 0.55;
}

export function extractResumeText(input: TextExtractionInput): ExtractionResult {
  const started = Date.now();
  let text = cleanFieldValue(input.text);
  const warnings: string[] = [];

  if (text.length > PHASE4_MAX_TEXT_CHARS) {
    text = text.slice(0, PHASE4_MAX_TEXT_CHARS);
    warnings.push(`Only the first ${String(PHASE4_MAX_TEXT_CHARS)} characters were read.`);
  }

  const lines = linesOf(text);
  const email = text.match(EMAIL_PATTERN)?.[0] ?? null;
  const phone = text.match(PHONE_PATTERN)?.[0] ?? null;
  const github = text.match(GITHUB_PATTERN)?.[0] ?? null;
  const linkedin = text.match(LINKEDIN_PATTERN)?.[0] ?? null;
  const name = findName(lines);
  const collegeLine = findLine(lines, COLLEGE_PATTERN);
  const degree = text.match(DEGREE_PATTERN)?.[0] ?? null;
  const graduation = findGraduationYear(text);
  const courseworkLine = findLine(lines, /\b(coursework|courses|relevant coursework)\b/i);
  const skills = findSkills(text);
  const internships = findInternships(lines);
  const projects = findProjects(lines);

  const fields: ExtractedField[] = [
    field('full_name', name, name ? 'inferred' : 'missing', name ? 0.55 : 0, 'Review this before saving'),
    field('email', email, email ? 'confirmed' : 'missing', email ? confidenceFor('confirmed') : 0),
    field('phone', phone, phone ? 'confirmed' : 'missing', phone ? 0.9 : 0),
    field(
      'college_name',
      collegeLine,
      collegeLine ? 'inferred' : 'missing',
      collegeLine ? 0.6 : 0,
      collegeLine ? 'Detected from an institution line' : null,
    ),
    field('degree_stream', degree, degree ? 'inferred' : 'missing', degree ? 0.65 : 0),
    field(
      'graduation_year',
      graduation,
      graduation ? 'confirmed' : 'missing',
      graduation ? 0.8 : 0,
    ),
    field(
      'coursework',
      courseworkLine ? splitList(courseworkLine) : [],
      courseworkLine ? 'inferred' : 'missing',
      courseworkLine ? 0.55 : 0,
    ),
    field(
      'internships',
      internships,
      internships.length > 0 ? 'inferred' : 'missing',
      internships.length > 0 ? 0.55 : 0,
    ),
    field(
      'skills_claimed',
      skills,
      skills.length > 0 ? 'inferred' : 'missing',
      skills.length > 0 ? 0.6 : 0,
      'Matches names in the text; not proof of skill',
    ),
    field(
      'projects_listed',
      projects,
      projects.length > 0 ? 'inferred' : 'missing',
      projects.length > 0 ? 0.5 : 0,
    ),
    field('github_url', github, github ? 'confirmed' : 'missing', github ? confidenceFor('confirmed') : 0),
    field(
      'linkedin_url',
      linkedin,
      linkedin ? 'confirmed' : 'missing',
      linkedin ? confidenceFor('confirmed') : 0,
    ),
  ];

  const found = fields.filter((entry) => entry.status !== 'missing').length;
  if (found === 0) {
    warnings.push('No resume fields were recognized. Paste clearer plain text or continue with manual answers.');
  }
  if (!collegeLine) {
    warnings.push('Institution tier was not inferred. Select it yourself on this screen.');
  }

  return {
    provider: 'local_deterministic_text',
    providerVersion: 'phase4.local-text.v1',
    status: found === 0 ? 'failed' : found < 4 ? 'partial' : 'ok',
    fields,
    warnings,
    elapsedMs: input.elapsedMs ?? Math.max(0, Date.now() - started),
    sourceName: sanitizeSourceName(input.sourceName),
    rawTextStored: false,
  };
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'text']);

export function isSupportedTextFile(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(extension);
}

export function unsupportedFileMessage(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? 'file';
  if (extension === 'pdf' || extension === 'docx' || extension === 'doc') {
    return `PDF/DOCX parsing (IBM Docling) is not connected in this build. Copy the resume text and paste it instead.`;
  }
  return `This file type is not supported. Use .txt, .md or paste the text.`;
}
