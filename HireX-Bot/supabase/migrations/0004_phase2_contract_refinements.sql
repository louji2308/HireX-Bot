-- Phase 2 contract refinements found in the close-out review.
-- Applied after 0001-0003 on both the local harness and the hosted project.

-- ---------------------------------------------------------------------------
-- 1. Erasure is an explicit, transaction-scoped authorization, not a role name.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_historical_score_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_message CONSTANT TEXT := 'Historical practice_sessions and session_responses are strictly append-only. Create a new session row for retakes or rubric changes.';
    v_cert_columns CONSTANT TEXT[] := ARRAY['merkle_root_hash', 'trustmodel_cert_url'];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF current_setting('hirex.erasure', true) = 'on' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION '%', v_message;
    END IF;

    IF TG_TABLE_NAME IN ('session_responses', 'candidate_skill_history') THEN
        IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
            RAISE EXCEPTION '%', v_message;
        END IF;
        RETURN NEW;
    END IF;

    IF (to_jsonb(NEW) - v_cert_columns) IS DISTINCT FROM (to_jsonb(OLD) - v_cert_columns) THEN
        RAISE EXCEPTION '%', v_message;
    END IF;

    IF current_user <> 'postgres' THEN
        RAISE EXCEPTION '%', v_message;
    END IF;

    IF (OLD.merkle_root_hash IS NOT NULL AND NEW.merkle_root_hash IS DISTINCT FROM OLD.merkle_root_hash)
       OR (OLD.trustmodel_cert_url IS NOT NULL AND NEW.trustmodel_cert_url IS DISTINCT FROM OLD.trustmodel_cert_url) THEN
        RAISE EXCEPTION '%', v_message;
    END IF;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Exact five-tier confidence vocabulary (em dash as specified).
-- ---------------------------------------------------------------------------

ALTER TABLE public.interview_blueprints
    DROP CONSTRAINT interview_blueprints_confidence_tier_check;

ALTER TABLE public.interview_blueprints
    ADD CONSTRAINT interview_blueprints_confidence_tier_check
    CHECK (confidence_tier IN (
        'Confirmed — Employer Supplied',
        'Verified — Official Documentation',
        'Verified — Vacancy Specification',
        'High-Confidence Inferred',
        'Company-Informed Simulation'
    ));

-- ---------------------------------------------------------------------------
-- 3. A published blueprint version is immutable; corrections create a new row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_blueprint_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('hirex.erasure', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Interview blueprints are versioned and immutable. Insert a new blueprint_version instead.';
END;
$$;

CREATE TRIGGER trg_immutable_interview_blueprints
    BEFORE UPDATE OR DELETE ON public.interview_blueprints
    FOR EACH ROW EXECUTE FUNCTION public.prevent_blueprint_mutation();

-- ---------------------------------------------------------------------------
-- 4. Sessions snapshot the blueprint version; replay evidence is attachable once.
-- ---------------------------------------------------------------------------

ALTER TABLE public.practice_sessions
    ADD COLUMN blueprint_version TEXT NOT NULL DEFAULT 'v1.0';

DROP FUNCTION IF EXISTS public.record_practice_session(
    UUID, UUID, INT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB
);

CREATE OR REPLACE FUNCTION public.record_practice_session(
    p_candidate_id UUID,
    p_blueprint_id UUID,
    p_session_number INT,
    p_company_name TEXT,
    p_job_role TEXT,
    p_round_type TEXT,
    p_calibration_mode TEXT,
    p_difficulty_vector JSONB,
    p_rubric_version_id TEXT,
    p_weighted_score DOUBLE PRECISION,
    p_baseline_delta DOUBLE PRECISION,
    p_responses JSONB,
    p_replay_jsonl_url TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_session_id UUID;
    v_response JSONB;
    v_blueprint RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.id = p_candidate_id) THEN
        RAISE EXCEPTION 'candidate profile not found';
    END IF;

    SELECT b.company_name, b.job_role, b.round_type, b.blueprint_version
    INTO v_blueprint
    FROM public.interview_blueprints b
    WHERE b.id = p_blueprint_id
      AND (b.candidate_id IS NULL OR b.candidate_id = p_candidate_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'blueprint is not available to this candidate';
    END IF;

    IF p_company_name <> v_blueprint.company_name
       OR p_job_role <> v_blueprint.job_role
       OR p_round_type <> v_blueprint.round_type THEN
        RAISE EXCEPTION 'session company, role and round must match the referenced blueprint';
    END IF;

    IF jsonb_typeof(p_responses) <> 'array' OR jsonb_array_length(p_responses) = 0 THEN
        RAISE EXCEPTION 'responses must be a non-empty JSON array';
    END IF;

    INSERT INTO public.practice_sessions (
        candidate_id, blueprint_id, session_number, company_name, job_role, round_type,
        calibration_mode, difficulty_vector, rubric_version_id, weighted_score, baseline_delta,
        replay_jsonl_url, blueprint_version
    ) VALUES (
        p_candidate_id, p_blueprint_id, p_session_number, p_company_name, p_job_role, p_round_type,
        p_calibration_mode, p_difficulty_vector, p_rubric_version_id, p_weighted_score,
        p_baseline_delta, p_replay_jsonl_url, v_blueprint.blueprint_version
    ) RETURNING id INTO v_session_id;

    FOR v_response IN SELECT * FROM jsonb_array_elements(p_responses) LOOP
        IF v_response->'topic_tags' IS NULL OR jsonb_typeof(v_response->'topic_tags') <> 'array' THEN
            RAISE EXCEPTION 'each response requires a topic_tags array';
        END IF;
        IF v_response->'criterion_scores' IS NULL OR jsonb_typeof(v_response->'criterion_scores') <> 'object' THEN
            RAISE EXCEPTION 'each response requires criterion_scores';
        END IF;

        INSERT INTO public.session_responses (
            session_id, question_index, topic_tags, question_prompt, candidate_code_or_text,
            language_used, hints_used_count, independent_first_attempt, duration_seconds,
            criterion_scores, evidence_feedback_md
        ) VALUES (
            v_session_id,
            (v_response->>'question_index')::INT,
            ARRAY(SELECT jsonb_array_elements_text(v_response->'topic_tags')),
            v_response->>'question_prompt',
            v_response->>'candidate_code_or_text',
            COALESCE(v_response->>'language_used', 'en'),
            COALESCE((v_response->>'hints_used_count')::INT, 0),
            COALESCE((v_response->>'independent_first_attempt')::BOOLEAN, TRUE),
            (v_response->>'duration_seconds')::INT,
            v_response->'criterion_scores',
            v_response->>'evidence_feedback_md'
        );
    END LOOP;

    RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_practice_session(
    UUID, UUID, INT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_practice_session(
    UUID, UUID, INT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Skill history is keyed by the response that produced it, and the
--    candidate must own the session.
-- ---------------------------------------------------------------------------

ALTER TABLE public.candidate_skill_history
    ADD COLUMN response_id UUID REFERENCES public.session_responses(id) ON DELETE CASCADE;

ALTER TABLE public.candidate_skill_history
    DROP CONSTRAINT candidate_skill_history_session_topic_key;

CREATE UNIQUE INDEX candidate_skill_history_response_key
    ON public.candidate_skill_history (response_id)
    WHERE response_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_skill_history_coherence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_session_candidate UUID;
    v_response_session UUID;
BEGIN
    SELECT s.candidate_id INTO v_session_candidate
    FROM public.practice_sessions s WHERE s.id = NEW.session_id;

    IF v_session_candidate IS NULL OR v_session_candidate <> NEW.candidate_id THEN
        RAISE EXCEPTION 'skill history candidate does not own the referenced session';
    END IF;

    IF NEW.response_id IS NOT NULL THEN
        SELECT r.session_id INTO v_response_session
        FROM public.session_responses r WHERE r.id = NEW.response_id;
        IF v_response_session IS NULL OR v_response_session <> NEW.session_id THEN
            RAISE EXCEPTION 'skill history response does not belong to the referenced session';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_skill_history_coherence
    BEFORE INSERT ON public.candidate_skill_history
    FOR EACH ROW EXECUTE FUNCTION public.validate_skill_history_coherence();

-- ---------------------------------------------------------------------------
-- 6. Pipeline events only advance. Re-discovery cannot erase a human-approved
--    outcome or regress a later decision state.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_pipeline_event(
    p_candidate_id UUID,
    p_job_source TEXT,
    p_company_name TEXT,
    p_role_title TEXT,
    p_location TEXT,
    p_job_url TEXT,
    p_fit_scores_5d JSONB,
    p_decision_state TEXT,
    p_employer_outcome TEXT DEFAULT 'discovered'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_event_id UUID;
    v_outcome_rank CONSTANT JSONB := '{
        "blocked": 0, "discovered": 1, "awaiting_approval": 2, "applied": 3,
        "warm_outreach_sent": 4, "oa_received": 5, "interviewing": 6,
        "rejected": 7, "offer": 8
    }'::jsonb;
    v_state_rank CONSTANT JSONB := '{"State_1": 1, "State_2": 2, "State_3": 3, "State_4": 4}'::jsonb;
BEGIN
    INSERT INTO public.employment_pipeline_events (
        candidate_id, job_source, company_name, role_title, location, job_url,
        fit_scores_5d, decision_state, employer_outcome
    ) VALUES (
        p_candidate_id, p_job_source, p_company_name, p_role_title, p_location, p_job_url,
        p_fit_scores_5d, p_decision_state, p_employer_outcome
    )
    ON CONFLICT (candidate_id, company_name, role_title, location) DO UPDATE
    SET job_source = EXCLUDED.job_source,
        job_url = EXCLUDED.job_url,
        fit_scores_5d = EXCLUDED.fit_scores_5d,
        decision_state = CASE
            WHEN (v_state_rank ->> EXCLUDED.decision_state)::INT
                 >= (v_state_rank ->> employment_pipeline_events.decision_state)::INT
            THEN EXCLUDED.decision_state
            ELSE employment_pipeline_events.decision_state
        END,
        employer_outcome = CASE
            WHEN (v_outcome_rank ->> EXCLUDED.employer_outcome)::INT
                 >= (v_outcome_rank ->> employment_pipeline_events.employer_outcome)::INT
            THEN EXCLUDED.employer_outcome
            ELSE employment_pipeline_events.employer_outcome
        END,
        updated_at = NOW()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Writer RPCs for the five tables that had no write path at all.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_candidate_profile(
    p_candidate_id UUID,
    p_full_name TEXT,
    p_email TEXT,
    p_college_name TEXT DEFAULT NULL,
    p_college_tier TEXT DEFAULT NULL,
    p_degree_stream TEXT DEFAULT NULL,
    p_graduation_year INT DEFAULT NULL,
    p_parsed_resume_md TEXT DEFAULT NULL,
    p_onboarding_signals JSONB DEFAULT '{}'::jsonb,
    p_dpdp_consent_ledger JSONB DEFAULT '{}'::jsonb,
    p_preferred_language TEXT DEFAULT 'en',
    p_baseline_code_probe_score DOUBLE PRECISION DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.candidate_profiles (
        id, full_name, email, college_name, college_tier, degree_stream, graduation_year,
        parsed_resume_md, onboarding_signals, dpdp_consent_ledger, preferred_language,
        baseline_code_probe_score
    ) VALUES (
        p_candidate_id, p_full_name, p_email, p_college_name, p_college_tier, p_degree_stream,
        p_graduation_year, p_parsed_resume_md, p_onboarding_signals, p_dpdp_consent_ledger,
        p_preferred_language, p_baseline_code_probe_score
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        college_name = COALESCE(EXCLUDED.college_name, candidate_profiles.college_name),
        college_tier = COALESCE(EXCLUDED.college_tier, candidate_profiles.college_tier),
        degree_stream = COALESCE(EXCLUDED.degree_stream, candidate_profiles.degree_stream),
        graduation_year = COALESCE(EXCLUDED.graduation_year, candidate_profiles.graduation_year),
        parsed_resume_md = COALESCE(EXCLUDED.parsed_resume_md, candidate_profiles.parsed_resume_md),
        onboarding_signals = candidate_profiles.onboarding_signals || EXCLUDED.onboarding_signals,
        dpdp_consent_ledger = jsonb_set(
            candidate_profiles.dpdp_consent_ledger || (EXCLUDED.dpdp_consent_ledger - 'scopes'),
            '{scopes}',
            COALESCE(candidate_profiles.dpdp_consent_ledger->'scopes', '{}'::jsonb)
                || COALESCE(EXCLUDED.dpdp_consent_ledger->'scopes', '{}'::jsonb),
            true
        ),
        preferred_language = EXCLUDED.preferred_language,
        baseline_code_probe_score = COALESCE(
            EXCLUDED.baseline_code_probe_score,
            candidate_profiles.baseline_code_probe_score
        ),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.append_portfolio_artifact(
    p_candidate_id UUID,
    p_repo_url TEXT,
    p_credibility_score INT,
    p_dimension_scores JSONB,
    p_commit_sha TEXT DEFAULT NULL,
    p_ast_summary_md TEXT DEFAULT NULL,
    p_test_coverage_pct DOUBLE PRECISION DEFAULT 0.0,
    p_ci_passing BOOLEAN DEFAULT FALSE,
    p_live_url_status INT DEFAULT NULL,
    p_upgrade_sprint_tickets JSONB DEFAULT '[]'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.portfolio_artifacts (
        candidate_id, repo_url, commit_sha, ast_summary_md, credibility_score,
        dimension_scores, test_coverage_pct, ci_passing, live_url_status, upgrade_sprint_tickets
    ) VALUES (
        p_candidate_id, p_repo_url, p_commit_sha, p_ast_summary_md, p_credibility_score,
        p_dimension_scores, p_test_coverage_pct, p_ci_passing, p_live_url_status,
        p_upgrade_sprint_tickets
    ) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_apprenticeship_sprint(
    p_sprint_id UUID,
    p_candidate_id UUID,
    p_tier TEXT,
    p_issue_url TEXT,
    p_repo_name TEXT,
    p_scoped_hours INT DEFAULT NULL,
    p_localization_map_md TEXT DEFAULT NULL,
    p_pre_pr_test_passed BOOLEAN DEFAULT FALSE,
    p_pr_url TEXT DEFAULT NULL,
    p_merge_status TEXT DEFAULT 'assigned',
    p_completed_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.apprenticeship_sprints (
        id, candidate_id, tier, issue_url, repo_name, scoped_hours, localization_map_md,
        pre_pr_test_passed, pr_url, merge_status, completed_at
    ) VALUES (
        p_sprint_id, p_candidate_id, p_tier, p_issue_url, p_repo_name, p_scoped_hours,
        p_localization_map_md, p_pre_pr_test_passed, p_pr_url, p_merge_status, p_completed_at
    )
    ON CONFLICT (id) DO UPDATE
    SET localization_map_md = COALESCE(EXCLUDED.localization_map_md, apprenticeship_sprints.localization_map_md),
        pre_pr_test_passed = apprenticeship_sprints.pre_pr_test_passed OR EXCLUDED.pre_pr_test_passed,
        pr_url = COALESCE(EXCLUDED.pr_url, apprenticeship_sprints.pr_url),
        merge_status = EXCLUDED.merge_status,
        completed_at = COALESCE(EXCLUDED.completed_at, apprenticeship_sprints.completed_at);
    RETURN p_sprint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_blueprint_version(
    p_blueprint_id UUID,
    p_company_name TEXT,
    p_job_role TEXT,
    p_candidate_level TEXT,
    p_round_type TEXT,
    p_blueprint_version TEXT,
    p_evaluation_criteria_weights JSONB,
    p_question_distribution JSONB,
    p_duration_minutes INT,
    p_confidence_tier TEXT,
    p_source_urls JSONB DEFAULT '[]'::jsonb,
    p_candidate_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.interview_blueprints (
        id, candidate_id, company_name, job_role, candidate_level, round_type,
        blueprint_version, evaluation_criteria_weights, question_distribution,
        duration_minutes, confidence_tier, source_urls,
        visibility
    ) VALUES (
        p_blueprint_id, p_candidate_id, p_company_name, p_job_role, p_candidate_level,
        p_round_type, p_blueprint_version, p_evaluation_criteria_weights,
        p_question_distribution, p_duration_minutes, p_confidence_tier, p_source_urls,
        CASE WHEN p_candidate_id IS NULL THEN 'shared' ELSE 'candidate' END
    );
    RETURN p_blueprint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_skill_history(
    p_skill_id UUID,
    p_candidate_id UUID,
    p_session_id UUID,
    p_response_id UUID,
    p_topic_or_criterion TEXT,
    p_round_type TEXT,
    p_score_five_scale DOUBLE PRECISION,
    p_normalized_score DOUBLE PRECISION,
    p_is_first_attempt_unassisted BOOLEAN,
    p_rolling_confidence DOUBLE PRECISION,
    p_is_recurring_weakness BOOLEAN,
    p_next_recommended_action TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.candidate_skill_history (
        id, candidate_id, session_id, response_id, topic_or_criterion, round_type,
        score_five_scale, normalized_score, is_first_attempt_unassisted, rolling_confidence,
        is_recurring_weakness, next_recommended_action
    ) VALUES (
        p_skill_id, p_candidate_id, p_session_id, p_response_id, p_topic_or_criterion, p_round_type,
        p_score_five_scale, p_normalized_score, p_is_first_attempt_unassisted, p_rolling_confidence,
        p_is_recurring_weakness, p_next_recommended_action
    );
    RETURN p_skill_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. TPO cohort: order by real completion time (not a per-blueprint counter).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tpo_cohort()
RETURNS TABLE (
    candidate_ref UUID,
    full_name TEXT,
    college_name TEXT,
    graduation_year INT,
    session_count INT,
    baseline_score DOUBLE PRECISION,
    latest_score DOUBLE PRECISION,
    merged_prs INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_role TEXT := COALESCE(auth.jwt()->'app_metadata'->>'role', '');
    v_institution TEXT := NULLIF(btrim(COALESCE(auth.jwt()->'app_metadata'->>'institution', '')), '');
BEGIN
    IF v_role <> 'tpo' OR v_institution IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.full_name,
        c.college_name,
        c.graduation_year,
        (SELECT COUNT(*)::INT FROM public.practice_sessions s WHERE s.candidate_id = c.id),
        (SELECT s.weighted_score FROM public.practice_sessions s
            WHERE s.candidate_id = c.id ORDER BY s.created_at ASC, s.id ASC LIMIT 1),
        (SELECT s.weighted_score FROM public.practice_sessions s
            WHERE s.candidate_id = c.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1),
        (SELECT COUNT(*)::INT FROM public.apprenticeship_sprints a
            WHERE a.candidate_id = c.id AND a.merge_status IN ('merged', 'approved'))
    FROM public.candidate_profiles c
    WHERE lower(btrim(c.college_name)) = lower(v_institution)
      AND COALESCE((c.dpdp_consent_ledger #>> '{scopes,institution_cohort,status}') = 'granted', FALSE)
    ORDER BY c.full_name, c.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Passport proofs stop claiming "unassisted" when they were not, and label
--    certification explicitly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_passport(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_candidate_id UUID := auth.uid();
    v_consent BOOLEAN;
    v_published BOOLEAN;
    v_snapshot JSONB;
BEGIN
    IF v_candidate_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    SELECT COALESCE((dpdp_consent_ledger #>> '{scopes,public_passport_hosting,status}') = 'granted', FALSE),
           passport_published
    INTO v_consent, v_published
    FROM public.candidate_profiles
    WHERE id = v_candidate_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate profile not found';
    END IF;

    IF NOT v_consent THEN
        RAISE EXCEPTION 'public_passport_hosting consent is not granted';
    END IF;

    IF v_published THEN
        RAISE EXCEPTION 'passport already published; unpublish before republishing';
    END IF;

    SELECT jsonb_build_object(
        'schema_version', 1,
        'generated_at', NOW(),
        'passport_slug', p_slug,
        'candidate', jsonb_build_object(
            'full_name', c.full_name,
            'college_name', c.college_name,
            'degree_stream', c.degree_stream,
            'graduation_year', c.graduation_year
        ),
        'proofs', public.hirex_compact_jsonb_array(
            (
                SELECT jsonb_build_object(
                    'kind', 'mode_c_simulation',
                    'company_name', s.company_name,
                    'job_role', s.job_role,
                    'round_type', s.round_type,
                    'weighted_score', s.weighted_score,
                    'rubric_version_id', s.rubric_version_id,
                    'blueprint_version', s.blueprint_version,
                    'merkle_root_hash', s.merkle_root_hash,
                    'trustmodel_cert_url', s.trustmodel_cert_url,
                    'certified', (s.merkle_root_hash IS NOT NULL OR s.trustmodel_cert_url IS NOT NULL),
                    'unassisted', COALESCE((
                        SELECT bool_and(r.independent_first_attempt AND r.hints_used_count = 0)
                        FROM public.session_responses r
                        WHERE r.session_id = s.id
                    ), FALSE),
                    'completed_at', s.created_at
                )
                FROM public.practice_sessions s
                WHERE s.candidate_id = c.id AND s.calibration_mode = 'Mode_C'
                ORDER BY s.created_at DESC, s.session_number DESC
                LIMIT 1
            ),
            (
                SELECT jsonb_build_object(
                    'kind', 'repository_audit',
                    'repo_url', p.repo_url,
                    'credibility_score', p.credibility_score,
                    'test_coverage_pct', p.test_coverage_pct,
                    'ci_passing', p.ci_passing,
                    'audited_at', p.audited_at
                )
                FROM public.portfolio_artifacts p
                WHERE p.candidate_id = c.id
                ORDER BY p.audited_at DESC
                LIMIT 1
            ),
            (
                SELECT jsonb_build_object(
                    'kind', 'merged_apprenticeship',
                    'repo_name', a.repo_name,
                    'issue_url', a.issue_url,
                    'pr_url', a.pr_url,
                    'merge_status', a.merge_status,
                    'completed_at', a.completed_at
                )
                FROM public.apprenticeship_sprints a
                WHERE a.candidate_id = c.id AND a.merge_status IN ('merged', 'approved')
                ORDER BY a.completed_at DESC NULLS LAST
                LIMIT 1
            )
        )
    )
    INTO v_snapshot
    FROM public.candidate_profiles c
    WHERE c.id = v_candidate_id;

    UPDATE public.candidate_profiles
    SET passport_slug = p_slug,
        passport_snapshot = v_snapshot,
        passport_published = TRUE,
        passport_published_at = NOW()
    WHERE id = v_candidate_id;

    RETURN v_snapshot;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Erasure uses the explicit marker; it also clears the vault column.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.erase_candidate(p_candidate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_responses INT := 0;
    v_skills INT := 0;
    v_sessions INT := 0;
    v_portfolio INT := 0;
    v_sprints INT := 0;
    v_pipeline INT := 0;
    v_blueprints INT := 0;
    v_profiles INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.candidate_profiles WHERE id = p_candidate_id) THEN
        RETURN jsonb_build_object('erased', FALSE, 'counts', '{}'::jsonb);
    END IF;

    PERFORM set_config('hirex.erasure', 'on', true);

    DELETE FROM public.session_responses r
    USING public.practice_sessions s
    WHERE r.session_id = s.id AND s.candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_responses = ROW_COUNT;

    DELETE FROM public.candidate_skill_history WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_skills = ROW_COUNT;

    DELETE FROM public.practice_sessions WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    DELETE FROM public.portfolio_artifacts WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_portfolio = ROW_COUNT;

    DELETE FROM public.apprenticeship_sprints WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_sprints = ROW_COUNT;

    DELETE FROM public.employment_pipeline_events WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_pipeline = ROW_COUNT;

    DELETE FROM public.interview_blueprints WHERE candidate_id = p_candidate_id;
    GET DIAGNOSTICS v_blueprints = ROW_COUNT;

    DELETE FROM public.candidate_profiles WHERE id = p_candidate_id;
    GET DIAGNOSTICS v_profiles = ROW_COUNT;

    PERFORM set_config('hirex.erasure', 'off', true);

    RETURN jsonb_build_object(
        'erased', TRUE,
        'counts', jsonb_build_object(
            'session_responses', v_responses,
            'candidate_skill_history', v_skills,
            'practice_sessions', v_sessions,
            'portfolio_artifacts', v_portfolio,
            'apprenticeship_sprints', v_sprints,
            'employment_pipeline_events', v_pipeline,
            'interview_blueprints', v_blueprints,
            'candidate_profiles', v_profiles
        )
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Indexes and column-level protection.
-- ---------------------------------------------------------------------------

CREATE INDEX practice_sessions_panel_e_idx
    ON public.practice_sessions (candidate_id, company_name, job_role, round_type, created_at DESC);

CREATE INDEX practice_sessions_baseline_idx
    ON public.practice_sessions (candidate_id, created_at ASC)
    INCLUDE (weighted_score, round_type);

-- The ciphertext vault must not be readable through a browser session. A
-- table-level SELECT grant implies every column, so replace it with an explicit
-- column grant that omits oauth_token_vault.
REVOKE SELECT ON public.candidate_profiles FROM authenticated;
GRANT SELECT (
    id, full_name, email, college_name, college_tier, degree_stream, graduation_year,
    parsed_resume_md, onboarding_signals, autonomy_level, dpdp_consent_ledger,
    preferred_language, baseline_code_probe_score, passport_slug, passport_published,
    passport_published_at, passport_snapshot, created_at, updated_at
) ON public.candidate_profiles TO authenticated;
GRANT SELECT (oauth_token_vault) ON public.candidate_profiles TO service_role;

-- ---------------------------------------------------------------------------
-- 12. Privileges for the new and replaced functions.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.prevent_blueprint_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_skill_history_coherence() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_candidate_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, JSONB, JSONB, TEXT, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.append_portfolio_artifact(UUID, TEXT, INT, JSONB, TEXT, TEXT, DOUBLE PRECISION, BOOLEAN, INT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_apprenticeship_sprint(UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.insert_blueprint_version(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, INT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.append_skill_history(UUID, UUID, UUID, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, DOUBLE PRECISION, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.upsert_candidate_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, JSONB, JSONB, TEXT, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_portfolio_artifact(UUID, TEXT, INT, JSONB, TEXT, TEXT, DOUBLE PRECISION, BOOLEAN, INT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_apprenticeship_sprint(UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_blueprint_version(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, INT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_skill_history(UUID, UUID, UUID, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, DOUBLE PRECISION, BOOLEAN, TEXT) TO service_role;
