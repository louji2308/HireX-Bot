-- HireX Bot Phase 2 — append-only triggers, DPDP RLS, public passport and TPO projections.
-- All write paths are SECURITY DEFINER functions owned by the migration role (postgres).
-- Direct table writes are revoked from anon, authenticated and service_role.

-- ---------------------------------------------------------------------------
-- Immutability guards (FR-801)
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
        IF current_user = 'postgres' THEN
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

CREATE TRIGGER trg_immutable_practice_sessions
    BEFORE UPDATE OR DELETE ON public.practice_sessions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_score_overwrite();

CREATE TRIGGER trg_immutable_session_responses
    BEFORE UPDATE OR DELETE ON public.session_responses
    FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_score_overwrite();

CREATE TRIGGER trg_immutable_candidate_skill_history
    BEFORE UPDATE OR DELETE ON public.candidate_skill_history
    FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_score_overwrite();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_candidate_profiles_updated_at
    BEFORE UPDATE ON public.candidate_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employment_pipeline_updated_at
    BEFORE UPDATE ON public.employment_pipeline_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (DPDP Rule 3 isolation). SELECT-only for candidate roles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hirex_owns_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.practice_sessions s
        WHERE s.id = p_session_id
          AND s.candidate_id = auth.uid()
    );
$$;

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apprenticeship_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skill_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_profiles_self_read ON public.candidate_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY portfolio_artifacts_self_read ON public.portfolio_artifacts
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

CREATE POLICY apprenticeship_sprints_self_read ON public.apprenticeship_sprints
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

CREATE POLICY interview_blueprints_scoped_read ON public.interview_blueprints
    FOR SELECT TO authenticated
    USING (candidate_id IS NULL OR candidate_id = auth.uid());

CREATE POLICY practice_sessions_self_read ON public.practice_sessions
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

CREATE POLICY session_responses_owner_read ON public.session_responses
    FOR SELECT TO authenticated
    USING (public.hirex_owns_session(session_id));

CREATE POLICY candidate_skill_history_self_read ON public.candidate_skill_history
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

CREATE POLICY employment_pipeline_events_self_read ON public.employment_pipeline_events
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

-- ---------------------------------------------------------------------------
-- Table privileges: candidates and service callers are SELECT-only.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.candidate_profiles FROM anon, authenticated, service_role;
REVOKE ALL ON public.portfolio_artifacts FROM anon, authenticated, service_role;
REVOKE ALL ON public.apprenticeship_sprints FROM anon, authenticated, service_role;
REVOKE ALL ON public.interview_blueprints FROM anon, authenticated, service_role;
REVOKE ALL ON public.practice_sessions FROM anon, authenticated, service_role;
REVOKE ALL ON public.session_responses FROM anon, authenticated, service_role;
REVOKE ALL ON public.candidate_skill_history FROM anon, authenticated, service_role;
REVOKE ALL ON public.employment_pipeline_events FROM anon, authenticated, service_role;

GRANT SELECT ON public.candidate_profiles TO authenticated, service_role;
GRANT SELECT ON public.portfolio_artifacts TO authenticated, service_role;
GRANT SELECT ON public.apprenticeship_sprints TO authenticated, service_role;
GRANT SELECT ON public.interview_blueprints TO authenticated, service_role;
GRANT SELECT ON public.practice_sessions TO authenticated, service_role;
GRANT SELECT ON public.session_responses TO authenticated, service_role;
GRANT SELECT ON public.candidate_skill_history TO authenticated, service_role;
GRANT SELECT ON public.employment_pipeline_events TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Write paths (server-only).
-- ---------------------------------------------------------------------------

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
    p_responses JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_session_id UUID;
    v_response JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.id = p_candidate_id) THEN
        RAISE EXCEPTION 'candidate profile not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.interview_blueprints b
        WHERE b.id = p_blueprint_id
          AND (b.candidate_id IS NULL OR b.candidate_id = p_candidate_id)
    ) THEN
        RAISE EXCEPTION 'blueprint is not available to this candidate';
    END IF;

    IF jsonb_typeof(p_responses) <> 'array' OR jsonb_array_length(p_responses) = 0 THEN
        RAISE EXCEPTION 'responses must be a non-empty JSON array';
    END IF;

    INSERT INTO public.practice_sessions (
        candidate_id, blueprint_id, session_number, company_name, job_role, round_type,
        calibration_mode, difficulty_vector, rubric_version_id, weighted_score, baseline_delta
    ) VALUES (
        p_candidate_id, p_blueprint_id, p_session_number, p_company_name, p_job_role, p_round_type,
        p_calibration_mode, p_difficulty_vector, p_rubric_version_id, p_weighted_score, p_baseline_delta
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

CREATE OR REPLACE FUNCTION public.mint_session_certificate(
    p_session_id UUID,
    p_merkle_root_hash TEXT,
    p_trustmodel_cert_url TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_merkle_root_hash IS NULL AND p_trustmodel_cert_url IS NULL THEN
        RAISE EXCEPTION 'at least one certification value is required';
    END IF;

    UPDATE public.practice_sessions
    SET merkle_root_hash = COALESCE(merkle_root_hash, p_merkle_root_hash),
        trustmodel_cert_url = COALESCE(trustmodel_cert_url, p_trustmodel_cert_url)
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'practice session not found';
    END IF;
END;
$$;

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
        decision_state = EXCLUDED.decision_state,
        employer_outcome = EXCLUDED.employer_outcome,
        updated_at = NOW()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hirex_compact_jsonb_array(VARIADIC p_items JSONB[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    FROM unnest(p_items) AS item
    WHERE item IS NOT NULL AND item <> 'null'::jsonb;
$$;

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
                    'kind', 'unassisted_mode_c_simulation',
                    'company_name', s.company_name,
                    'job_role', s.job_role,
                    'round_type', s.round_type,
                    'weighted_score', s.weighted_score,
                    'rubric_version_id', s.rubric_version_id,
                    'merkle_root_hash', s.merkle_root_hash,
                    'trustmodel_cert_url', s.trustmodel_cert_url,
                    'independent_first_attempt', (
                        SELECT bool_and(r.independent_first_attempt)
                        FROM public.session_responses r
                        WHERE r.session_id = s.id
                    ),
                    'completed_at', s.created_at
                )
                FROM public.practice_sessions s
                WHERE s.candidate_id = c.id AND s.calibration_mode = 'Mode_C'
                ORDER BY s.session_number DESC
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

CREATE OR REPLACE FUNCTION public.unpublish_passport()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;

    UPDATE public.candidate_profiles
    SET passport_published = FALSE,
        passport_snapshot = NULL,
        passport_published_at = NULL
    WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_passport(p_slug TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT CASE
        WHEN c.passport_published
         AND COALESCE((c.dpdp_consent_ledger #>> '{scopes,public_passport_hosting,status}') = 'granted', FALSE)
        THEN c.passport_snapshot
        ELSE NULL
    END
    FROM public.candidate_profiles c
    WHERE c.passport_slug = p_slug;
$$;

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
            WHERE s.candidate_id = c.id ORDER BY s.session_number ASC LIMIT 1),
        (SELECT s.weighted_score FROM public.practice_sessions s
            WHERE s.candidate_id = c.id ORDER BY s.session_number DESC LIMIT 1),
        (SELECT COUNT(*)::INT FROM public.apprenticeship_sprints a
            WHERE a.candidate_id = c.id AND a.merge_status IN ('merged', 'approved'))
    FROM public.candidate_profiles c
    WHERE c.college_name = v_institution
      AND COALESCE((c.dpdp_consent_ledger #>> '{scopes,institution_cohort,status}') = 'granted', FALSE)
    ORDER BY c.full_name;
END;
$$;

-- ---------------------------------------------------------------------------
-- Erasure (DPDP Rule 3 one-click cascade). Deletes only through this definer.
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
-- Function privileges.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.prevent_historical_score_overwrite() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hirex_owns_session(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_practice_session(UUID, UUID, INT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mint_session_certificate(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_pipeline_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hirex_compact_jsonb_array(JSONB[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.publish_passport(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.unpublish_passport() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_public_passport(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tpo_cohort() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.erase_candidate(UUID) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hirex_owns_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_practice_session(UUID, UUID, INT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mint_session_certificate(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_pipeline_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_passport(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_passport() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_passport(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tpo_cohort() TO authenticated;
GRANT EXECUTE ON FUNCTION public.erase_candidate(UUID) TO service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
