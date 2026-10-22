-- HireX Bot Phase 2 — canonical 8-table schema (FR-801).
-- Runs unchanged on Supabase PostgreSQL 16/17 and on the local PG16 verification container.
-- No extension is required: gen_random_uuid() is built into PostgreSQL 13+.

CREATE TABLE public.candidate_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 200),
    email TEXT NOT NULL,
    college_name TEXT CHECK (college_name IS NULL OR length(college_name) <= 200),
    college_tier TEXT CHECK (college_tier IN ('Tier_1', 'Tier_2', 'Tier_3', 'Rural_Autonomous', 'Other')),
    degree_stream TEXT,
    graduation_year INT CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1980 AND 2100),
    parsed_resume_md TEXT,
    onboarding_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    autonomy_level INT NOT NULL DEFAULT 2 CHECK (autonomy_level BETWEEN 1 AND 4),
    dpdp_consent_ledger JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferred_language TEXT NOT NULL DEFAULT 'en'
        CHECK (preferred_language IN ('ta', 'hi', 'te', 'kn', 'bn', 'mr', 'en')),
    baseline_code_probe_score FLOAT CHECK (baseline_code_probe_score BETWEEN 0 AND 100),
    oauth_token_vault JSONB NOT NULL DEFAULT '{}'::jsonb,
    passport_slug TEXT CHECK (passport_slug IS NULL OR passport_slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
    passport_published BOOLEAN NOT NULL DEFAULT FALSE,
    passport_published_at TIMESTAMPTZ,
    passport_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT candidate_profiles_email_key UNIQUE (email),
    CONSTRAINT candidate_profiles_passport_slug_key UNIQUE (passport_slug),
    CONSTRAINT candidate_profiles_publication_complete CHECK (
        passport_published = FALSE
        OR (passport_slug IS NOT NULL AND passport_snapshot IS NOT NULL AND passport_published_at IS NOT NULL)
    )
);

CREATE INDEX candidate_profiles_college_idx
    ON public.candidate_profiles (college_name)
    WHERE college_name IS NOT NULL;

CREATE TABLE public.interview_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    job_role TEXT NOT NULL,
    candidate_level TEXT NOT NULL
        CHECK (candidate_level IN ('Intern', 'New_Grad_Fresher', 'Entry_Level_0_2Y', 'Mid_Level')),
    round_type TEXT NOT NULL CHECK (round_type IN (
        'Resume_Screen', 'Online_Assessment', 'Recruiter_Screen', 'Coding',
        'Technical_Fundamentals', 'Project_Discussion', 'Role_Specific_Practical',
        'System_Design', 'Behavioral', 'Final_HR_Offer'
    )),
    blueprint_version TEXT NOT NULL DEFAULT 'v1.0',
    evaluation_criteria_weights JSONB NOT NULL,
    question_distribution JSONB NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    confidence_tier TEXT NOT NULL CHECK (confidence_tier IN (
        'Confirmed - Employer Supplied',
        'Verified - Official Documentation',
        'Verified - Vacancy Specification',
        'High-Confidence Inferred',
        'Company-Informed Simulation'
    )),
    source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    visibility TEXT NOT NULL DEFAULT 'shared'
        CHECK (visibility IN ('shared', 'candidate')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT interview_blueprints_visibility_scope
        CHECK ((visibility = 'shared') = (candidate_id IS NULL)),
    CONSTRAINT interview_blueprints_version_key
        UNIQUE NULLS NOT DISTINCT
            (candidate_id, company_name, job_role, candidate_level, round_type, blueprint_version)
);

CREATE INDEX interview_blueprints_lookup_idx
    ON public.interview_blueprints (company_name, job_role, candidate_level, round_type);

CREATE TABLE public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES public.interview_blueprints(id),
    session_number INT NOT NULL CHECK (session_number >= 1),
    company_name TEXT NOT NULL,
    job_role TEXT NOT NULL,
    round_type TEXT NOT NULL CHECK (round_type IN (
        'Resume_Screen', 'Online_Assessment', 'Recruiter_Screen', 'Coding',
        'Technical_Fundamentals', 'Project_Discussion', 'Role_Specific_Practical',
        'System_Design', 'Behavioral', 'Final_HR_Offer'
    )),
    calibration_mode TEXT NOT NULL CHECK (calibration_mode IN ('Mode_A', 'Mode_B', 'Mode_C')),
    difficulty_vector JSONB NOT NULL,
    rubric_version_id TEXT NOT NULL,
    weighted_score FLOAT NOT NULL CHECK (weighted_score BETWEEN 0 AND 100),
    baseline_delta FLOAT NOT NULL DEFAULT 0.0,
    replay_jsonl_url TEXT,
    merkle_root_hash TEXT,
    trustmodel_cert_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT practice_sessions_candidate_blueprint_number_key
        UNIQUE (candidate_id, blueprint_id, session_number)
);

CREATE INDEX practice_sessions_panel_b_idx
    ON public.practice_sessions (candidate_id, round_type, company_name, job_role, session_number)
    INCLUDE (weighted_score, baseline_delta, created_at);
CREATE INDEX practice_sessions_candidate_created_idx
    ON public.practice_sessions (candidate_id, created_at DESC);
CREATE INDEX practice_sessions_blueprint_idx
    ON public.practice_sessions (blueprint_id);

CREATE TABLE public.session_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    question_index INT NOT NULL CHECK (question_index >= 0),
    topic_tags TEXT[] NOT NULL,
    question_prompt TEXT NOT NULL,
    candidate_code_or_text TEXT NOT NULL,
    language_used TEXT NOT NULL DEFAULT 'en',
    hints_used_count INT NOT NULL DEFAULT 0 CHECK (hints_used_count >= 0),
    independent_first_attempt BOOLEAN NOT NULL DEFAULT TRUE,
    duration_seconds INT NOT NULL CHECK (duration_seconds >= 0),
    criterion_scores JSONB NOT NULL,
    evidence_feedback_md TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT session_responses_session_question_key UNIQUE (session_id, question_index)
);

CREATE TABLE public.portfolio_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    repo_url TEXT NOT NULL,
    commit_sha TEXT,
    ast_summary_md TEXT,
    credibility_score INT NOT NULL CHECK (credibility_score BETWEEN 0 AND 100),
    dimension_scores JSONB NOT NULL,
    test_coverage_pct FLOAT DEFAULT 0.0 CHECK (test_coverage_pct BETWEEN 0 AND 100),
    ci_passing BOOLEAN DEFAULT FALSE,
    live_url_status INT,
    upgrade_sprint_tickets JSONB DEFAULT '[]'::jsonb,
    socratic_defense_session_id UUID,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX portfolio_artifacts_candidate_idx
    ON public.portfolio_artifacts (candidate_id, audited_at DESC);
CREATE INDEX portfolio_artifacts_defense_session_idx
    ON public.portfolio_artifacts (socratic_defense_session_id)
    WHERE socratic_defense_session_id IS NOT NULL;

CREATE TABLE public.apprenticeship_sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('Tier_A_CFI', 'Tier_B_OSS', 'Tier_C_Startup_xSpan')),
    issue_url TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    scoped_hours INT CHECK (scoped_hours BETWEEN 5 AND 40),
    localization_map_md TEXT,
    pre_pr_test_passed BOOLEAN NOT NULL DEFAULT FALSE,
    pr_url TEXT,
    merge_status TEXT NOT NULL DEFAULT 'assigned'
        CHECK (merge_status IN ('assigned', 'in_review', 'merged', 'approved')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX apprenticeship_sprints_candidate_idx
    ON public.apprenticeship_sprints (candidate_id, merge_status, completed_at DESC);

CREATE TABLE public.candidate_skill_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    topic_or_criterion TEXT NOT NULL,
    round_type TEXT NOT NULL,
    score_five_scale FLOAT NOT NULL CHECK (score_five_scale BETWEEN 0.0 AND 5.0),
    normalized_score FLOAT NOT NULL CHECK (normalized_score BETWEEN 0.0 AND 100.0),
    is_first_attempt_unassisted BOOLEAN NOT NULL,
    rolling_confidence FLOAT NOT NULL DEFAULT 0.5 CHECK (rolling_confidence BETWEEN 0.0 AND 1.0),
    is_recurring_weakness BOOLEAN NOT NULL DEFAULT FALSE,
    next_recommended_action TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT candidate_skill_history_session_topic_key UNIQUE (session_id, topic_or_criterion)
);

CREATE INDEX candidate_skill_history_topic_idx
    ON public.candidate_skill_history (candidate_id, topic_or_criterion, recorded_at DESC);
CREATE INDEX candidate_skill_history_recorded_idx
    ON public.candidate_skill_history (candidate_id, recorded_at DESC);

CREATE TABLE public.employment_pipeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
    job_source TEXT NOT NULL,
    company_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    location TEXT,
    job_url TEXT NOT NULL,
    fit_scores_5d JSONB NOT NULL,
    decision_state TEXT NOT NULL CHECK (decision_state IN ('State_1', 'State_2', 'State_3', 'State_4')),
    tailored_resume_pdf_url TEXT,
    micro_deliverable_url TEXT,
    skill_passport_url TEXT,
    employer_outcome TEXT NOT NULL DEFAULT 'discovered' CHECK (employer_outcome IN (
        'discovered', 'awaiting_approval', 'applied', 'warm_outreach_sent',
        'oa_received', 'interviewing', 'offer', 'rejected', 'blocked'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT employment_pipeline_events_job_key
        UNIQUE NULLS NOT DISTINCT (candidate_id, company_name, role_title, location)
);

CREATE INDEX employment_pipeline_events_updated_idx
    ON public.employment_pipeline_events (candidate_id, updated_at DESC);
CREATE INDEX employment_pipeline_events_state_idx
    ON public.employment_pipeline_events (candidate_id, decision_state);
CREATE INDEX employment_pipeline_events_outcome_idx
    ON public.employment_pipeline_events (candidate_id, employer_outcome);

ALTER TABLE public.portfolio_artifacts
    ADD CONSTRAINT portfolio_artifacts_defense_session_fkey
    FOREIGN KEY (socratic_defense_session_id)
    REFERENCES public.practice_sessions(id)
    ON DELETE SET NULL;
