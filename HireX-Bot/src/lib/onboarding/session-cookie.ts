export const INTAKE_COOKIE_NAME = 'hirex_intake';
export const INTAKE_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;

export function isIntakeSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function intakeCookieOptions(): {
  readonly httpOnly: true;
  readonly sameSite: 'lax';
  readonly secure: boolean;
  readonly path: '/';
  readonly maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: INTAKE_COOKIE_MAX_AGE_SECONDS,
  };
}
