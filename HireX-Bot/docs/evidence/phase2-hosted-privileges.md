# Phase 2 — hosted privilege verification

Project: `hirex-bot` (`krmstikdkjmplhrbtiqs`), ap-south-1, PostgreSQL 17.11.0.003.
Verified: 2026-10-21, after `0003_function_privilege_hardening.sql` and
`0004_phase2_contract_refinements.sql` were applied.

## `has_function_privilege` matrix

| Function | anon | authenticated | service_role |
|---|---|---|---|
| `get_public_passport(text)` | **true** | true | false |
| `publish_passport(text)` | false | **true** | false |
| `unpublish_passport()` | false | **true** | false |
| `tpo_cohort()` | false | **true** | false |
| `erase_candidate(uuid)` | false | false | **true** |
| `record_practice_session(...)` | false | false | **true** |
| `mint_session_certificate(...)` | false | false | **true** |
| `hirex_owns_session(uuid)` | false | **true** | true |
| `upsert_candidate_profile(...)` | false | false | **true** |
| `insert_blueprint_version(...)` | false | false | **true** |
| `append_portfolio_artifact(...)` | false | false | **true** |
| `upsert_apprenticeship_sprint(...)` | false | false | **true** |
| `append_skill_history(...)` | false | false | **true** |
| `upsert_pipeline_event(...)` | false | false | **true** |
| `hirex_compact_jsonb_array(jsonb[])` | false | false | false |

Raw result row (spot checks):

```json
{"service_passport":false,"anon_passport":true,"auth_tpo":true,
 "auth_profile_writer":false,"auth_vault_read":false}
```

## Catalog checks

- 8 tables, all with RLS enabled.
- 8 policies, all `SELECT`.
- 7 application triggers (append-only history, certificate guard, blueprint
  immutability, skill-history coherence, `updated_at` helpers).
- 14 `SECURITY DEFINER` functions, owner `postgres`.
- 2 `NULLS NOT DISTINCT` idempotency keys.
- Tables readable by `anon`: 0.
- `authenticated`: explicit column `SELECT` on `candidate_profiles` that omits
  `oauth_token_vault`; no `INSERT`/`UPDATE`/`DELETE`.
- `service_role`: `SELECT` plus the writer RPCs.
- `authenticated` cannot read `candidate_profiles.oauth_token_vault`
  (`has_column_privilege = false`).

## Defects found and fixed

1. Supabase's default privileges granted `EXECUTE` on new functions to `anon`,
   `authenticated` and `service_role`. `REVOKE ... FROM PUBLIC` alone did not
   remove those role grants, so before hardening an anonymous caller could
   execute `erase_candidate` and `publish_passport`. `0003` revokes from all
   three roles and re-grants only the intended set.
2. A table-level `GRANT SELECT` implies every column, including
   `oauth_token_vault`. `0004` revokes table-level `SELECT` on
   `candidate_profiles` from `authenticated` and re-grants an explicit column
   list that omits the vault.
3. `0004` was applied to the hosted project via the Management API; hosted
   catalog checks above confirm the new columns, triggers, writer RPCs and
   column-level grant.
