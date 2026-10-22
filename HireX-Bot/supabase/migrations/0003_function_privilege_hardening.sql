-- Supabase grants EXECUTE on new functions to anon/authenticated/service_role
-- through project-level default privileges. Revoking from PUBLIC alone therefore
-- leaves those explicit grants intact. This migration removes every inherited
-- grant and re-applies the least-privilege matrix.
--
-- Verified on the hosted project: anon could execute publish_passport and
-- erase_candidate before this migration ran.

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
