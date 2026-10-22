-- LOCAL VERIFICATION ONLY — never applied to a hosted Supabase project.
-- Reproduces the minimum auth surface the migrations depend on:
--   auth.users(id), auth.uid(), auth.jwt(), roles anon/authenticated/service_role.
-- Tests connect as hirex_app (NOSUPERUSER NOBYPASSRLS) and SET LOCAL ROLE, never as postgres.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(
        COALESCE(
            NULLIF(current_setting('request.jwt.claim.sub', TRUE), ''),
            (NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb) ->> 'sub'
        ),
        ''
    )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb,
        '{}'::jsonb
    );
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hirex_app') THEN
        CREATE ROLE hirex_app LOGIN PASSWORD 'hirex' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, hirex_app;
GRANT SELECT ON auth.users TO anon, authenticated, service_role, hirex_app;

GRANT anon, authenticated, service_role TO hirex_app;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, hirex_app;
