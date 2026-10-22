# HireX Bot — Progress Ledger

Canonical implementation ledger (AGENTS.md §15). One file, no duplicates.

---

## Current Phase / Status

**Phase 1 ? Cognitive Swarm Foundation**
Status: **GATE MET WITH FOUR RECORDED DEVIATIONS.** Typecheck, 165 offline tests, 5 live sandbox tests, a container re-run, a production build and a live `/api/health` check all pass. The remaining gaps are explicit, tested-in-the-negative deviations (polyglot coverage, AgentFoundry host, LangGraph, automatic Reflexion invocation) rather than missing Phase 1 code. Phase 2 is committed as `3f120bc` and pushed to `origin/main`; see the Phase 2 section at the end of this file.

---

## Current Objective

Open Phase 3 (light-theme UI shell, five-tab floating pill navigation, shared primitives, durable Inngest event bus) with its prescribed 8-agent swarm before coding.

---

## Verified Complete Capabilities

| Capability | Evidence |
|---|---|
| Monochrome design foundation (canvas `#FAFAFA`, surface `#FFFFFF`, subtle `#F4F4F5`, obsidian `#0A0A0B`, hairline `#E4E4E7`, focus `#18181B`, pill radius, Raleway/JetBrains stacks) | `tailwind.config.ts`, `src/app/globals.css`, `tests/phase1/design-tokens.test.ts` (24 tests) |
| Self-hosted typography: Raleway 400/500/600 + JetBrains Mono 400 via `@font-face` and preload | `public/fonts/*.woff2`, `src/app/layout.tsx`; browser reported `document.fonts.load('600 16px Raleway')` → `loaded` |
| Untrusted-data envelope: NFKC → entity/URI decode (bounded) → delimiter strip → angle-bracket escape, SHA-256 digest, 1 MB bound | `src/lib/security/untrusted-envelope.ts`, `tests/bootstrap/untrusted-envelope.test.ts` (17 tests incl. property tests) |
| Smart-Code router: deterministic task→lab map, 429 cross-lab failover with zero sleep, 5xx same-lab backoff, one schema repair, circuit breaker, single deadline, abort handling | `src/agents/router.ts`, `tests/phase1/smart-code-router.test.ts` (19 tests) |
| Provenance: successes always carry evidence; failures carry no `output`; certifiable classes never resolve to local | `src/types/phase1_contracts.ts`, router tests |
| Token budget ledger: reserve/settle/release, scope binding, settle-exactly-once, live-reservation-aware caps, auto-reclaim of expired leases, L0–L4 ladder, conservative unverified clamp | `src/lib/swarm/budget-ledger.ts`, `tests/phase1/budget-ledger.test.ts` (12 tests) |
| Canonical `lessons.json` (L-001…L-007) with verification states and atomic appends | `src/lib/swarm/lessons.ts`, `tests/phase1/swarm-memory.test.ts` (12 tests) |
| Lesson injection into every system prompt (verified-only, top 3, enveloped as untrusted memory) | `src/agents/prompts/lessons-context.ts`, `src/agents/prompts/memory-registry.ts`, `tests/phase1/memory-and-skills.test.ts` (18 tests) |
| Runtime memory composition: lessons + episodic store + skill artifacts constructed once per process | `src/lib/swarm/runtime.ts`; `/api/health` reported 3 lessons, 3 skills, 0 artifact problems |
| Episodic failure memory: deterministic 384-dim hashed embedding, JSONL store, top-k retrieval; Qdrant REST adapter behind `QDRANT_URL` | `src/lib/swarm/episodic-store.ts`, `src/lib/swarm/qdrant-store.ts`, `src/lib/swarm/store-factory.ts`, `tests/phase1/episodic-store-qdrant.test.ts` (7 tests) |
| Voyager skill registry with artifact verification | `src/lib/voyager-skills/registry.ts`: `skill:untrusted-envelope-v1`, `skill:smart-code-router-v1`, `skill:piston-polyglot-runner-v1` |
| Swarm orchestrator: independent proposals → critique → arbitration; evidence/alternative/risk/testable-claim validation; bounded failure codes | `src/lib/swarm/orchestrator.ts`, `tests/phase1/swarm-orchestration.test.ts` (18 tests) |
| Reflexion + lessons promotion: drafts are unverified; promotion requires a passing regression test | `src/lib/swarm/reflexion.ts` |
| DPO trajectory record with secret/PII redaction; `training_eligible` is always `false` | `src/lib/swarm/trajectory.ts`, `trajectories/phase_01_dpo.jsonl` (4 pairs) |
| Piston client: 11-outcome typed union, honest probe, per-language verification, endpoint failover, ambiguity-safe kill classification | `src/lib/piston/client.ts`, `tests/phase1/piston-client.test.ts` (25 tests) |
| Sandbox composition root: env-driven, loopback default, remote opt-in, language allowlist | `src/lib/piston/service.ts`, `tests/phase1/sandbox-service.test.ts` (8 tests) |
| Real sandboxed execution (python 3.10.0 + node 21.11.1) with enforced limits | `tests/integration/piston-live.test.ts` (5/5 live tests) |
| Read-only readiness surface | `src/app/api/health/route.ts`; live 210: verified `["javascript","python"]`, 3 lessons, JSONL store |
| Trusted prompt registry (no candidate data in system prompts) | `src/agents/prompts/index.ts`, router prompt-safety tests |
| Production build + real render | `npm run build`; page served on `:3100`; 0 console errors; contrast 18.96:1; screenshot `docs/evidence/phase1-home.png` |
| Container reproducibility | `scripts/verify-container.ps1` → 165 passed / 5 skipped inside `node:21-bookworm-slim` |

---

## Phase 1 Exit Gate vs. Build Plan (`Build Plan.md` Step 1.1–1.5)

| Step | Requirement | Status | Evidence / reason |
|---|---|---|---|
| 1.1 | `sanitizeAndWrapUntrusted` + SHA-256 digest | **MET** | `src/lib/security/untrusted-envelope.ts`, 17 tests |
| 1.1 | Bootstrap tests executed inside an isolated container | **MET** | `scripts/verify-container.ps1`, `docs/evidence/phase1-container-verify.txt` |
| 1.1 | Critic writes `L-001` from a real failing assertion | **MET** | `swarm/memory/lessons.json#L-001` |
| 1.1 | Re-run with `lessons.json` injected into the agent's system prompt | **MET** | `composeSystemPrompt`/`withLessonMemory`; `/api/health` reports 3 injected lesson ids |
| 1.1 | Promote as Voyager Skill #1 | **MET** | `src/lib/voyager-skills/registry.ts` (3 skills, artifacts verified) |
| 1.2 | 2-agent bootstrap, then an 8-agent opening swarm | **DEVIATION** | 8 read-only subagents (R1–R4, D1–D3, V1) ran, but **after** implementation, not at phase start (§4 ordering violation recorded) |
| 1.2 | R1–R4, D1–D3, arbitration and a frozen contract | **MET (order deviation)** | Reports collected; arbitration applied; contract frozen with one additive v1.1 amendment |
| 1.3 | `smart-code-router`, `design-tokens`, `swarm-memory` suites (+ fast-check) | **MET** | 19 + 24 + 12 tests; fast-check in 2 suites |
| 1.4 | `Coder-Swarm`: lessons store + episodic failure store | **MET (Qdrant→JSONL deviation)** | `lessons.ts`, `episodic-store.ts`; Qdrant adapter available but not exercised live |
| 1.4 | `Coder-Swarm`: MoA debate orchestrator, `ReflexionAgent`, lessons preloader, `VoyagerSkillRegistry` | **MET (LangGraph→TS deviation)** | `orchestrator.ts`, `reflexion.ts`, `memory-registry.ts`, `registry.ts` |
| 1.4 | `Coder-Router`: taxonomy, failover, Zod repair, budget, envelope | **MET** | 19 router tests, envelope composed in `router.ts` |
| 1.4 | `Coder-Router`: Ollama offline fallback | **PARTIAL** | `createOllamaTransport()` implements the transport contract; router wiring exists only via injected transports; never reached a live model |
| 1.4 | `Coder-Sandbox`: client, 3 s CPU / 128 MB caps | **MET** | 25 unit tests + 5 live tests (SIGKILL ~3.1 s, 134,216,000 B) |
| 1.4 | `Coder-Sandbox`: automatic AgentFoundry fallback | **PARTIAL** | Configurable `PISTON_FALLBACK_BASE_URLS` failover verified with a dead primary; no AgentFoundry VM exists to target |
| 1.4 | `Coder-Sandbox`: polyglot runner (Python 3.12, Java 21, C++ 21, JS/TS, SQL) | **PARTIAL** | Python 3.10.0 + Node 21.11.1 installed and probed; TS/Java/C++/SQL packages failed to install (timeouts) and are reported unsupported |
| 1.4 | `Coder-Theme`: tokens, layout, typography | **MET (font substitution)** | Tokens + self-hosted Raleway/JetBrains Mono; `Google Sans Flex` unavailable → system display fallback |
| 1.5 | `tsc --noEmit && vitest run` inside a verification container | **MET** | `node:21-bookworm-slim`, 165 passed / 5 skipped |
| 1.5 | Automated Reflexion → `lessons.json` on every failure | **PARTIAL** | `draftReflexion`/`promoteReflexion`/`recordReflexion` exist and are tested; no runner invokes them automatically yet |
| 1.5 | Register `skill:untrusted-envelope-v1`, `skill:smart-code-router-v1`, `skill:piston-polyglot-runner-v1` | **MET** | Registry + artifact verification + health surface |
| 1.5 | DPO trajectory appended | **MET** | 4 pairs, `training_eligible: false` (honestly not training data) |

**Unrecorded deviations needing approval:** none. Qdrant→JSONL, LangGraph→TS orchestrator, AgentFoundry→configurable endpoint failover, `Google Sans Flex`→system display face, and the reduced runtime set are now recorded below.

---

## Partial / Missing / Broken / Unverified

| Item | State | Consequence |
|---|---|---|
| Sandbox host portability | **Partial** — self-hosted on this developer machine only (WSL2 + Docker); python 3.10.0 + node 21.11.1 | The gate is satisfied for local development and the demo, but nothing is deployed and four planned languages cannot execute. |
| Sandbox availability after WSL idle | **Known limitation** — the WSL VM shuts down when idle and Windows HTTP cannot wake it | `/api/health` reports degraded until `npm run sandbox:up` runs. Keep the keep-alive process running during a demo. |
| Budget ledger durability | **Partial** — in-memory only | Correct for one Node process; multi-instance would overspend. Replace behind the same interface in Phase 2. |
| SMART-Code gateway transport | **Unverified** — contract + adapter only | No credential has been exercised. Endpoint shape, model IDs and the 1,000,000-token grant remain unverified. |
| Ollama transport | **Unverified** — implemented, never reached a live daemon | Offline generation is not proven. |
| Persistence, auth, RLS | **Missing** — Phase 2 | No database exists yet; nothing candidate-facing is stored. |
| ESLint / CI | **Missing** — deferred | Gate is `tsc --noEmit && vitest run`; lint/CI is a Phase 10 dependency and must not be reported as present. |
| `Google Sans Flex` | **Unavailable** | Not publicly served; display falls back to a system face. Recorded design deviation. |
| Qdrant adapter | **Unit-tested only** — never connected to a live Qdrant | Store selection and REST shape are proven with an injected fetch; real latency/collection behaviour is unverified. |
| Product user path | **Missing** — Phase 3+ | Phase 1 exposes no candidate workflow; `/api/health` is the only server route. |

---

## Active Work and Exclusive Owners

| Work package | Owner | Files |
|---|---|---|
| Coder-Swarm / memory / runtime | Orchestrator (single owner) | `src/lib/swarm/**`, `src/lib/voyager-skills/**`, `swarm/memory/**` |
| Coder-Router | Orchestrator | `src/agents/**`, `src/types/phase1_contracts.ts` |
| Coder-Sandbox | Orchestrator | `src/lib/piston/**`, `src/app/api/health/**`, `scripts/sandbox-up.ps1`, `tests/integration/**` |
| Coder-Theme | Orchestrator | `src/app/**`, `public/fonts/**`, `tailwind.config.ts`, `postcss.config.mjs` |
| Tester | Orchestrator | `tests/**` |

Only one writer per file per wave; no competing implementations were merged. Read-only reviewers held no write access.

---

## Phase Swarm: agents actually invoked

Runtime: eight read-only subagent invocations were made in one OpenCode session — four reconnaissance and three decision passes plus an independent verifier. They are distinct model contexts with separate prompts; they are **not** eight separately configured custom agent profiles.

| Pass | Role | Deliverable (condensed) |
|---|---|---|
| R1 | Repo / scaffold recon | Declared later-phase directories absent; `@/*` alias sound; no competing implementations |
| R2 | Token-economics recon | 1M grant unverified, 300k effective clamp, 80k/30k/4k scopes; found reused-id and cap-bypass ledger defects |
| R3 | Typography / contrast recon | Tokens exact-match Design; Google Sans Flex never served; contrast computed |
| R4 | Sandbox / memory recon | Limits match; python 3.10 ≠ 3.12; no AgentFoundry host; Qdrant never exercised |
| D1 | Pragmatic architect | Loopback default, failover only on infrastructure faults, executor provenance, per-endpoint probe |
| D2 | Red teamer | Catalogue≠runnable, green health while dead, 401 is configuration not candidate failure, unauthenticated executor risk |
| D3 | Reliability | Failure taxonomy (`executor_ready`/`waking`/`unreachable`/`timeout`/`unauthorized`/`rate_limited`/`catalogue_unavailable`/`execution_not_verified`) |
| V1 | Independent verifier | Re-ran the gate (136 at the time), live suite 5/5, found README stale at 84 tests and flagged unwired runtime memory |

**Ordering deviation (AGENTS §4):** the swarm ran after the implementation wave instead of at phase start. It still changed the code (probe honesty, loopback default, memory-kill precedence, budget concurrency), but the phase-start decision contract was not frozen first. This is recorded, not hidden; Phase 2 must run the opening swarm before coding.

---

## Latest Decisions and Rationale

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| 1 | Nine task classes, one deterministic primary lab each; a turn cannot probe and score | Prevents a borderline prompt from silently choosing the cheaper lab and prevents an ungraded probe being shown as evidence | Five-class router split on model boundary |
| 2 | `RouteSuccess` requires `evidence`; `RouteFailure` has no `output`; `QUESTION_QC`/`RESPONSE_GRADING` may never run local | Makes provenance structurally unavoidable rather than a caller convention | Optional metadata |
| 3 | 429 → other lab, zero added delay; 5xx → same lab, jittered backoff (150 ms × 2, cap 1210 ms); one repair turn | A rate-limited lab stays limited; same-lab backoff burns the single deadline | Same-lab retry on 429 |
| 4 | Reserve the **completion** budget; settle actual total and report `overageTokens` | The per-call cap bounds generation; exact prompt tokens are known only after the gateway responds | Reserving prompt + completion (exceeded the 4k per-call cap) |
| 5 | Envelope order: NFKC → decode → strip → escape | Literal-tag stripping is bypassed by `%3C`/`&#60;`/full-width forms | Regex-only closing-tag strip |
| 6 | Embedding via signed feature hashing; vectors never persisted | Zero cost, zero network, deterministic, auditable | Hosted embedding API |
| 7 | Self-host Piston under WSL2; default to loopback; remote endpoints require explicit `PISTON_ALLOW_REMOTE=1` | Public host returns 401 on execute; candidate code must not leave the machine by accident | Public `emkc.org`; silent remote fallback |
| 8 | Capability means "a probe program actually ran", not "the catalogue lists it" | A listed language can still fail at run time; a health badge must reflect execution | Catalogue-only health check |
| 9 | Lessons are injected as untrusted memory inside the envelope | Retrieved text is attacker-influenceable; it must not gain instruction authority | Pasting lessons into trusted system text |
| 10 | `killed` is a distinct outcome from `time_limit_exceeded` | A SIGKILL without a reported limit cannot be attributed to the candidate | Reporting every SIGKILL as a timeout |

---

## Tests / Commands / Runtime Evidence

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| `npm test` (`vitest run`) | **PASS** — 12 files, 165 passed, 5 live tests skipped by design |
| `npm run verify` | **PASS** — typecheck + tests |
| `npm run build` (`next build`) | **PASS** — `/`, `/icon.svg`, dynamic `/api/health`; 103 kB first load |
| `next start -p 3100` + browser load | **PASS** — HTTP 210, 0 console messages, 0 failed requests |
| `GET /api/health` | **PASS (210)** — sandbox `verifiedLanguages: ["javascript","python"]`, executor `127.0.0.1:2100/api/v2`, 3 lessons (top-3 by confidence: L-001, L-003, L-005), 3 skills, 0 artifact problems, JSONL store, 676 ms |
| `npm run sandbox:up` | **PASS** — container up, endpoint reachable from Windows |
| `npm run test:sandbox` (`PISTON_LIVE=1`) | **PASS** — 5/5: capability authorized; Python `45`; JavaScript `45`; runaway loop → `time_limit_exceeded` ~3.1 s; 400 MB → exit 137 at 134,216,000 B |
| Container gate (`scripts/verify-container.ps1`) | **PASS** — `node:21-bookworm-slim`, 165 passed / 5 skipped |
| `GET https://emkc.org/api/v2/piston/runtimes` / `POST /execute` | **210** / **401** (public host is not used) |

Evidence artifacts: `docs/evidence/phase1-home.png`, `docs/evidence/phase1-container-verify.txt`, `docs/evidence/phase1-sandbox-live.txt`, `docs/evidence/phase1-health.txt`.
Decision log (not training data): `trajectories/phase_01_dpo.jsonl` — 4 preference pairs, `training_eligible: false`; no model training, fine-tuning or DPO was performed.

---

## Known Risks / Blockers / External Dependencies

1. **Sandbox is a local developer host, not a deployment** — WSL2 + Docker, two runtimes, 128 MiB / 3 s limits. The WSL VM idles out; keep-alive is required for demos.
2. **SMART-Code grant unverified** — 1,000,000 tokens specced against a ~5.2M workload; clamped to 300k while unverified.
3. **Model IDs unverified against the live gateway** (`claude-haiku-4-5`, `gpt-5-codex`) — confirm with a real call before any phase presents them as live.
4. **In-memory budget** — single-instance only.
5. **No git repository** — no commit exists; nothing has been pushed.
6. **Hackathon deadline** — cloud submission 2126-11-15, judging 2126-12-05. Nine phases remain; Phase 1 consumed the foundation budget.

---

## Scope Deviations and Approvals

| Deviation | Reason | Status |
|---|---|---|
| Added `focus: '#18181B'` as a 7th color token | `Design.md` names a focus token but omits its value | Recorded; needs reviewer sign-off |
| `Google Sans Flex` replaced by a system display face | Not publicly served; unlicensed copies are not acceptable | Recorded; needs design sign-off |
| LangGraph/DSPy replaced by a dependency-free TypeScript orchestrator | $0 budget and fewer moving parts; same proposal→critique→arbitration contract | Recorded; needs approval before Phase 4 orchestration work |
| Vector store defaults to JSONL; Qdrant adapter available behind `QDRANT_URL` | Fewer services at $0; adapter preserves the upgrade path | Recorded; needs approval |
| AgentFoundry replaced by ordered endpoint failover | No AgentFoundry VM/credentials exist | Recorded; defer to Phase 7 deployment decision |
| TypeScript/Java/C++/SQL runtimes not installed | Package installs timed out; only python + node verified | Recorded; Phase 6/7 dependency |
| Reflexion is a library, not an automatic failure hook | No workflow invokes it yet | Recorded; wire in Phase 2/4 |
| ESLint deferred | Not part of the Phase 1 gate | Recorded; Phase 10 dependency |
| Budget reservation covers completion only | Prompt tokens are unknown pre-call | Recorded (Decision 4) |
| Phase 1 UI limited to `/`, `/icon.svg`, `/api/health` | Route groups belong to Phase 3/4 | Recorded |

---

## Last Verified Commit / Deployment

- Commit: **`3f120bc`** on `main` (Phase 2), pushed to `origin/main`; Phase 1 was `5f1e05a`.
- Deployment: **local only** --- production build served on `http://127.0.0.1:3100`; `/api/health` returned 210 at verification time.
- Verification identity: Node `v24.13.0` (host) / `node:21-bookworm-slim` (container), npm `11.6.2`, Next `15.5.28`, Vitest `2.1.9`, TypeScript `5.9.3`.

---

## Next Highest-Value Action

**Close the Phase 2 gate, then open Phase 3.**

1. Re-run `npm run verify`, `npm run pg:verify` and `npm run build`; capture the outputs in `docs/evidence/phase2-*`.
2. Review the Phase 2 diff for scope, secrets and generated files; commit only `HireX-Bot/` after approval.
3. Open Phase 3 (UI shell, five-tab pill navigation, shared primitives, durable Inngest event bus) with its 8-agent phase-start swarm before coding.
4. Carry forward: wire the persistence RPCs into user paths from Phase 4; replace the in-memory budget ledger behind its interface; wire Reflexion into the failure path; install remaining Piston runtimes before Phase 6/7.

---

## Phase 2 --- Hybrid Persistence Substrate

### Status

**GATE MET AND COMMITTED (`3f120bc`, pushed to `origin/main`).** Local gate: typecheck clean, `251` offline tests pass across `23` files (`5` live sandbox tests skipped), and `80/80` Phase 2 database tests pass against real PostgreSQL 16.15. Hosted migrations `0001`--`0004` are applied and the privilege matrix is verified. Evidence is captured in `docs/evidence/phase2-*`.

### Verified complete

| Capability | Evidence |
|---|---|
| Exactly eight canonical tables with panel indexes, CHECKs and `NULLS NOT DISTINCT` idempotency keys | `supabase/migrations/0001_hirex_bot_schema.sql`; `tests/phase2/panel-indexes.test.ts` (4 tests) |
| Append-only historical scoring under an explicit erasure GUC; owner-only certificate minting; retake rolls back atomically | `0002_triggers_and_rls.sql` + `0004_phase2_contract_refinements.sql`; `tests/phase2/schema-immutability.test.ts` (9 tests) |
| RLS: SELECT-only for `authenticated`, zero `anon` table access, no candidate write path | `tests/phase2/rls-isolation.test.ts` (6 tests) |
| DPDP erasure cascade across all candidate-owned rows, preserving other candidates and shared blueprints | `tests/phase2/dpdp-cascade.test.ts` (4 tests) |
| Consent-gated public passport with PII-free snapshot and withdrawal behavior | `tests/phase2/public-passport.test.ts` (4 tests) |
| TPO cohort RPC gated by `app_metadata.role`, institution and `institution_cohort` consent, ordered by first activity | hosted catalog + `tests/phase2/contract-refinements.test.ts` |
| Least-privilege function grants and a column grant that hides `oauth_token_vault` | `0003_function_privilege_hardening.sql`; `tests/phase2/privilege-matrix.test.ts` (2 tests); hosted `has_function_privilege` / `has_column_privilege` matrix |
| Writer RPCs for profile upsert (deep consent merge), portfolio, apprenticeships, blueprint versions and skill history | `0004_phase2_contract_refinements.sql`; `tests/phase2/contract-refinements.test.ts` (14 tests) |
| Published blueprints are immutable; corrections create a new version | `prevent_blueprint_mutation` trigger; `contract-refinements.test.ts` |
| AES-256-GCM token vault with candidate/provider/purpose AAD and key rotation | `src/lib/supabase/vault.ts`; `tests/phase2/token-vault.test.ts` (6 tests) |
| OAuth grant revocation and storage purge as part of erasure | `src/lib/supabase/token-revocation.ts`, `storage.ts`; `tests/phase2/revocation-storage.test.ts` (10 tests) |
| LLM-backed memory consolidation through the SMART-Code router with strict grounding checks (real response id, criterion and unchanged score), plus the deterministic offline baseline | `src/lib/memory/llm-consolidator.ts`, `src/lib/memory/llm-runtime.ts`, `src/agents/llm-transport.ts`; `tests/phase2/llm-consolidator.test.ts` (6 tests), `memory-consolidator.test.ts` (8 tests) |
| `DELETE /api/candidate/erase` authenticates, revokes grants, erases DB/memory/storage, deletes the auth identity and writes a PII-free receipt; every stage runs despite an earlier failure | `src/app/api/candidate/erase/route.ts`; `tests/phase2/erase-route.test.ts` (13 tests) |
| Reproducible local PostgreSQL 16 harness with a non-local/non-test reset guard | `scripts/pg-up.ps1`, `pg-down.ps1`, `pg-verify.ps1`; `supabase/local/0000_auth_shim.sql`; `supabase/seed.sql` |
| Generated schema types wired into both server clients | `src/types/database.types.ts` (regenerated after `0004`); `src/lib/supabase/server.ts` |
| Judge-demo fixture with a visible improvement curve | Arjun rows in `supabase/seed.sql` (`58/67/69/76`) |

### Deviations and blockers (recorded, not hidden)

| Item | State | Consequence |
|---|---|---|
| Hosted PostgreSQL is 17, spec/local is 16 | **ACCEPTED DEVIATION** | Schema behavior is verified on 16; 17-specific differences are not exhaustively tested |
| No LLM credentials in this environment | **BLOCKED** | The LLM path, transport, router integration and grounding checks are tested with an injected fetch, but no live model call or real `memory.jsonl` semantic fact has been produced here. Set `HIREX_LLM_API_KEY` + `HIREX_LLM_BASE_URL` to activate |
| No service-role key or OAuth client credentials available here | **BLOCKED** | A live hosted erase/revocation call is unverified; the route is tested with injected clients. Missing GitHub credentials are counted as a failed revocation, never faked |
| Local `service_role` lacks BYPASSRLS | **TEST DESIGN** | Local RLS assertions use the candidate role; privileged setup uses the migration owner |
| `hirex_compact_jsonb_array` and trigger functions are not executable by app roles | **BY DESIGN** | Verified on the hosted catalog |

### Tests / commands / evidence

```text
npx tsc --noEmit                     -> clean
npm run verify                       -> 251 passed, 5 skipped, 24 files (23 passed, 1 skipped)
npm run pg:verify                    -> 80 passed, 11 files (PostgreSQL 16.15)
npm run build                        -> clean (Next 15.5.28; /api/health and /api/candidate/erase compiled)
hosted has_function_privilege matrix -> anon: passport read only; authenticated: publish/unpublish/tpo/owns; service_role: writes/erase/mint
hosted has_column_privilege          -> authenticated cannot read candidate_profiles.oauth_token_vault
```

### Next action

Phase 2 is committed and pushed. Open Phase 3 with its prescribed 8-agent swarm before coding.
