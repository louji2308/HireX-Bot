# HireX Bot

Autonomous proof-of-work, apprenticeship and employment architecture for India's first-time technology job seekers.

Built for **Code for a Billion — Bharat Agentic-AI Hackathon 2026**, Track 10 (Tech Employment for Youth).

> **Status: Phase 3 (monochrome workspace shell and event contracts).** The five-tab workspace, six-state workflow store, Inngest event contracts, governance placeholder and honest telemetry are implemented and locally tested. There is no deployed origin, authenticated session, durable checkpoint store, or registered Inngest function yet; see [Progress.md](Progress.md) for the verified state, evidence and open blockers.

---

## What exists today

| Area | What it does |
|---|---|
| Design foundation | Monochrome "obsidian on alabaster" tokens, Tailwind contract, self-hosted Raleway + JetBrains Mono, five-tab floating pill shell and focus strip |
| Untrusted-data envelope | Sanitises resume/JD/code/web text before it can enter a prompt, and returns a SHA-256 digest for provenance |
| Smart-Code router | Deterministic task → model routing across two labs, typed failures, rate-limit failover, bounded backoff, one schema repair, circuit breaker, single deadline |
| Budget ledger | Reserve / settle / release with scope binding, settle-exactly-once, live-reservation-aware caps and an L0–L4 conservation ladder |
| Verified memory | Append-only `swarm/memory/lessons.json`, lesson injection into every system prompt, JSONL episodic store with an optional Qdrant adapter |
| Voyager skills | Nine promoted skills across Phases 1-3 with documented inputs, outputs, security notes and artifact verification |
| Swarm orchestration | Independent proposals → critique → arbitration, with mandatory evidence and testable claims; Reflexion drafts that cannot be promoted without a passing regression test |
| Sandbox | Piston adapter with a typed outcome union, per-language probe verification, endpoint failover and a live suite proving the 3 s / 128 MiB limits |
| Readiness surface | `GET /api/health` reports the probed sandbox capability, lesson injection count, active memory store and skill artifact state |

Every successful model call returns `evidence` (source, model, tier, prompt hash, untrusted digest, schema hash, budget level). Every failure returns **no output field at all**. Tasks that can become hiring evidence (`QUESTION_QC`, `RESPONSE_GRADING`) can never be produced by the local model.

---

## Requirements

- Node.js 20+ (verified on `v24.13.0`)
- npm 10+ (verified on `11.6.2`)
- **Optional, for real code execution:** WSL2 with Docker (verified on Ubuntu 26.04, Docker 29.1.3) and the `piston` container. Nothing else in Phase 1 needs it.
- **Optional, for the Phase 2 database suites:** WSL2 with Docker. `npm run pg:up` starts PostgreSQL 16 on `127.0.0.1:55432`; the tests skip cleanly when it is absent.

No environment variables are required to run the app. Copy `.env.example` to `.env.local` if you need to change the sandbox endpoint, connect a Supabase project, or configure the token vault. Do not add real credentials to the repository; `.env*` is ignored except `.env.example`.

---

## Commands

```bash
npm install          # install dependencies
npm run dev          # development server on http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm test             # vitest run (offline; live sandbox tests are skipped)
npm run verify       # typecheck + tests (the gate used in this phase)
npm run sandbox:up   # start/verify the sandbox from Windows and keep WSL awake
npm run sandbox:down
npm run test:sandbox # sandbox:up + the opt-in live execution tests
npm run pg:up        # start PostgreSQL 16 in WSL for the Phase 2 database tests
npm run test:db      # database suites only (RLS, triggers, DPDP, passport, privileges)
npm run pg:verify    # pg:up + apply local shim/schema/seed + all Phase 2 tests
npm run pg:down      # remove the throwaway PostgreSQL container
```

`npm test` is fully offline: transport, clock and budget are injected, so no test performs a network call or reads a real secret. Only `npm run test:sandbox` requires the container. `npm run test:db` and `npm run pg:verify` require the `hirex-pg` container and are skipped otherwise unless `HIREX_DB_REQUIRED=1`.

---

## Code execution sandbox (optional)

The verified setup is self-hosted Piston inside WSL2:

```bash
docker run -d --privileged --name piston --restart unless-stopped \
  -p 2000:2000 -v piston_data:/piston ghcr.io/engineer-man/piston
```

The app defaults to `http://127.0.0.1:2000/api/v2`. The public host is **not** the default: its `/runtimes` is public but `/execute` returns 401 without credentials. A non-loopback endpoint is refused unless `PISTON_ALLOW_REMOTE=1` is set, so candidate source cannot be posted to an unknown third party by accident. `PISTON_FALLBACK_BASE_URLS` accepts ordered comma-separated fallbacks; each endpoint is probed on its own.

`npm run sandbox:up` performs that check for you, verifies the endpoint **from Windows** (where the app runs), and can keep the WSL VM alive. Two host behaviours matter:

- The VM shuts down when idle, and a Windows HTTP request cannot wake it. Keep the keep-alive process running during a demo, or every call reports `infra_error`.
- Ports must be published on `2000` (all interfaces), not `127.0.0.1:2000`; a loopback-only publish is not reliably reachable from Windows after the container restarts.

Installed and probed on the demo host: **python 3.10.0** and **node 20.11.1**. Verified limits: 3 s wall clock (`status: "TO"`, SIGKILL) and a 128 MiB cgroup kill (exit 137 at 134,216,000 bytes). TypeScript, Java, C++ and SQL are **not** installed; they are reported as unsupported rather than silently offered.

---

## Persistence substrate (Phase 2)

Phase 2 adds the hybrid persistence layer the later modules read and write through:

- **Hosted:** Supabase project `hirex-bot` (`krmstikdkjmplhrbtiqs`, ap-south-1). Migrations are applied from this repository, not hand-edited in the dashboard.
- **Schema:** exactly eight tables (`candidate_profiles`, `interview_blueprints`, `practice_sessions`, `session_responses`, `portfolio_artifacts`, `apprenticeship_sprints`, `candidate_skill_history`, `employment_pipeline_events`) with panel indexes, `NULLS NOT DISTINCT` idempotency keys and provenance foreign keys.
- **Append-only history:** a trigger rejects any update or delete of historical scores/responses except the erasure path (an explicit `hirex.erasure` GUC). Retakes create new session rows; certificates are minted once; published blueprints are immutable and corrections create a new version.
- **RLS:** every table is SELECT-only for `authenticated`; `anon` has no table access. All writes go through `SECURITY DEFINER` RPCs owned by `postgres`. `authenticated` has a column-level grant on `candidate_profiles` that omits `oauth_token_vault`.
- **Least privilege:** `0003_function_privilege_hardening.sql` revokes the EXECUTE grants Supabase's default privileges hand to `anon`/`authenticated`/`service_role`, then re-grants only what each role needs. For example, only `authenticated` may publish its own passport and only `service_role` may erase.
- **DPDP erase:** `DELETE /api/candidate/erase` authenticates the bearer token, revokes OAuth grants, calls `erase_candidate`, purges memory and storage, deletes the Supabase Auth identity, and appends a PII-free receipt. Every stage runs even if an earlier one fails; missing credentials are reported as a failed revocation, never faked.
- **Token vault:** OAuth tokens are sealed with AES-256-GCM using `TOKEN_VAULT_KEYS`; AAD binds ciphertext to candidate, provider and purpose. Keys rotate by adding a kid.
- **Memory:** production consolidation is LLM-backed through the SMART-Code router (`HIREX_LLM_API_KEY` + `HIREX_LLM_BASE_URL`), with strict post-validation that every fact cites a real response id, criterion and unchanged score. The deterministic function remains as an offline baseline only. Facts live in `swarm/memory/memory.jsonl`, keyed by a salted SHA-256 candidate reference; no raw prose or candidate text is stored. Tombstones block re-consolidation after erasure.

The local harness applies `supabase/local/0000_auth_shim.sql` (never deployed) so the same migrations run on real PostgreSQL 16. The hosted project currently runs PostgreSQL 17, one major version above the spec; behavior is exercised locally on 16.

---

## Workspace shell and event contracts (Phase 3)

Phase 3 adds the candidate-facing shell and the workflow contracts the later modules will use:

- **Five-tab floating pill:** Command, Opportunities, Studio, Proof and Passport map to the eight backend modules without duplicating state. The active pill expands; icon-only tabs keep accessible labels.
- **Routes:** `/dashboard`, `/opportunities`, `/interview`, `/interview/[id]`, `/proof`, `/passport-vault` and `/governance`. `/governance` is an explicit placeholder for the not-yet-built autonomy, consent and erase controls.
- **Six-state workflow contract:** `planned`, `running`, `awaiting_approval`, `requires_user_input`, `completed` and `failed`, with eleven legal edges, optimistic versions, duplicate suppression and a SHA-256 audit chain.
- **Approval safety:** a side-effecting completion requires a recorded `approval_granted` transition. A manual retry is rejected after a side effect is recorded, and an expired approval window must create a real `userInputRequestId` so the task cannot become unreachable.
- **Event contracts:** eight trigger events plus `application/approval.resolved` and `user.input.supplied`. URLs are restricted to HTTP(S), text and array sizes are bounded, commit SHAs are 7-40 hex characters, and unknown fields are rejected.
- **Durable waits:** `waitForApproval` and `waitForUserInput` match the task and candidate, and the input wait also matches the exact request id. A timeout is returned as a distinct outcome.
- **Inngest route:** `GET/POST/PUT /api/inngest` is a real serve handler with zero registered functions. It is not a durable execution implementation yet.
- **Honest telemetry:** the Judge Inspector shows only static or unavailable provenance, and the pulse strip reports not-started/unavailable instead of invented counts or latency.

There is no auth session, no Supabase checkpoint store and no registered Inngest workflow. The workspace is publicly reachable and the shell contains no live candidate data.

---

## Layout

```
src/
  app/                      # App Router: workspace tabs, /governance, health, erase, Inngest
  agents/
    router.ts               # deterministic SMART-Code router
    prompts/                # trusted system prompts + lesson injection
  components/               # navigation, workspace shell and telemetry components
  inngest/                  # event schemas, state machine, store and audit chain
  lib/
    navigation/             # route-to-chrome resolution
    security/untrusted-envelope.ts
    supabase/               # config, server clients, AES-256-GCM token vault
    memory/                 # deterministic consolidation + erasure receipts
    swarm/                  # lessons, episodic store, budget, orchestrator, reflexion
    voyager-skills/         # promoted skill registry
    piston/                 # sandbox client + server composition root
  types/phase1_contracts.ts # frozen Phase 1 interface (one documented amendment)
  types/phase3_contracts.ts # frozen Phase 3 workflow, navigation and telemetry contracts
  types/database.types.ts   # generated from the hosted schema
supabase/
  migrations/               # 0001 schema, 0002 triggers/RLS/RPCs, 0003 grant hardening, 0004 contract refinements
  local/0000_auth_shim.sql  # local-only auth schema/roles; never deployed
  seed.sql                  # deterministic fixtures
tests/                      # bootstrap/, phase1/, phase2/, phase3/, integration/ (opt-in live)
scripts/                    # sandbox, verify-container, pg-up/down/verify
swarm/memory/lessons.json   # verified prevention rules
trajectories/               # decision log (NOT training data)
docs/evidence/              # captured verification artifacts
```

`src/types/phase1_contracts.ts` is frozen for the Phase 1 wave. Changing it requires an evidenced change request that reviews every consumer. One additive amendment (v1.1) added `'retrieved_memory'` to `UNTRUSTED_SOURCES` so injected lessons travel through the sanctioned envelope.

---

## Verification

```bash
npm run verify        # typecheck + 247 offline tests (48 database/live tests skipped)
npm run pg:verify     # Phase 2 database suites against real PostgreSQL 16
npm run build
npm run test:sandbox  # live tests against a real executor
```

Last verified: typecheck clean, **247 offline tests passing across 33 files** (48 database/live tests skipped), production build clean, and the Phase 3 workspace rendered at desktop, mobile and focus-mode widths with no console errors (screenshots in `docs/evidence/phase3-*.png`). The Inngest route returns a real 200 in dev mode with zero registered functions; it has not been connected to a running Inngest server. Live sandbox verification from Phase 1 remains: real stdout for Python and JavaScript, a runaway loop killed at ~3.1 s, and a 400 MB allocation killed at 134,216,000 bytes.

The Phase 2 privilege matrix is also verified on the hosted project after `0004`: `anon` can only execute `get_public_passport`; `authenticated` can publish/unpublish, ask for its own session ownership and read the consent-gated TPO cohort; only `service_role` can use the writer RPCs, record sessions, mint certificates or erase. `authenticated` cannot read `candidate_profiles.oauth_token_vault`. Evidence is in `docs/evidence/phase2-*`.

The same suite was re-run inside a `node:20-bookworm-slim` container (`scripts/verify-container.ps1`) to show it does not depend on this machine's Node install.

---

## Known limitations

1. **The sandbox is a local developer host, not a deployment.** It runs in WSL2 + Docker on one machine, has two runtimes (python 3.10.0, node 20.11.1), and must be started with `npm run sandbox:up`. It cannot serve a deployed demo yet; only the client contract and enforcement evidence are portable.
2. **Persistence exists but is not yet on a user path.** The Phase 2 schema, RLS, erase route and token vault are verified by tests, but no UI or workflow reads them yet, and the budget ledger is still process-local. Phase 4+ will wire them.
3. **Hosted database differs by one major version.** Supabase runs PostgreSQL 17 while the spec and local tests use 16. Migration behavior is verified locally; hosted parity is not exhaustively tested.
4. **Hosted end-to-end auth is unverified.** No OAuth client credentials or service-role key were available in this environment, so sign-in and a live hosted erase call have not been executed. The route is tested with injected clients.
5. **Hosted auth deletion is unverified.** The erase handler calls `client.auth.admin.deleteUser(candidateId)` after the table and memory purge, but no live service-role call has been executed because the credentials were unavailable.
6. **LLM consolidation is implemented but not exercised live.** SMART-Code is not reachable with a verified key; the deterministic consolidator remains the only path verified end to end.
7. **The SMART-Code gateway is not exercised.** Model IDs and the 1,000,000-token grant are unverified; the ledger clamps to 300k and reports `grantVerified: false`. The Ollama transport exists but has never reached a live model.
8. **No ESLint gate yet.** CI now runs typecheck, tests and build; linting still needs a real ESLint configuration rather than a no-rule script.
9. **`Google Sans Flex` is not publicly served**, so the display stack falls back to a system face. Raleway and JetBrains Mono are self-hosted under the OFL.
10. **Repository layout.** Git's root is the Windows home directory, so the project lives at HireX-Bot/ inside it; the remote tracks only that folder.
11. **Swarm modules are not yet on a user path.** The orchestrator and Reflexion have tests but no product workflow calls them; that arrives with the later modules.
12. **The public server surface is small but not protected end to end.** `GET /api/health` is unauthenticated, `DELETE /api/candidate/erase` requires a bearer token, and `/api/inngest` serves zero registered functions. There is no candidate session, so the workspace routes themselves are public.
13. **Phases 4-10 are not implemented.** Opportunity discovery, scoring, simulation, proof-of-work, the passport and analytics have contracts or design notes but no working user path.

---

## Privacy and safety rules this code already enforces

- Candidate text is always wrapped in `<untrusted-data>` and never placed in a system prompt.
- Injected lessons are wrapped as untrusted memory; they are advisory and cannot change a role, schema or rubric.
- Instructions found inside untrusted content are treated as data, not commands.
- Logs carry identifiers, codes and counts only — never prompt text, model output or personal data.
- Rate limits and outages fail over; they are never reported as candidate failure.
- Local or degraded model output can never be certified as an employer-facing assessment.
