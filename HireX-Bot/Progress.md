# HireX Bot Ã¢â‚¬â€ Progress Ledger

Canonical implementation ledger (AGENTS.md Ã‚Â§15). One file, no duplicates.

---

## Current Phase / Status

**Phase 1 Ã¢â‚¬â€ Cognitive Swarm Foundation**
Status: **GATE MET WITH FOUR RECORDED DEVIATIONS.** Typecheck, 165 offline tests, 5 live sandbox tests, a container re-run, a production build and a live `/api/health` check all pass. The remaining gaps are explicit, tested-in-the-negative deviations (polyglot coverage, AgentFoundry host, LangGraph, automatic Reflexion invocation) rather than missing Phase 1 code. Phase 2 has not started.

---

## Current Objective

Open Phase 2 (hybrid persistence: eight-table Postgres schema, RLS/audit triggers, DPDP erase, episodic memory substrate) once the deviations below are approved.

---

## Verified Complete Capabilities

| Capability | Evidence |
|---|---|
| Monochrome design foundation (canvas `#FAFAFA`, surface `#FFFFFF`, subtle `#F4F4F5`, obsidian `#0A0A0B`, hairline `#E4E4E7`, focus `#18181B`, pill radius, Raleway/JetBrains stacks) | `tailwind.config.ts`, `src/app/globals.css`, `tests/phase1/design-tokens.test.ts` (24 tests) |
| Self-hosted typography: Raleway 400/500/600 + JetBrains Mono 400 via `@font-face` and preload | `public/fonts/*.woff2`, `src/app/layout.tsx`; browser reported `document.fonts.load('600 16px Raleway')` Ã¢â€ â€™ `loaded` |
| Untrusted-data envelope: NFKC Ã¢â€ â€™ entity/URI decode (bounded) Ã¢â€ â€™ delimiter strip Ã¢â€ â€™ angle-bracket escape, SHA-256 digest, 1 MB bound | `src/lib/security/untrusted-envelope.ts`, `tests/bootstrap/untrusted-envelope.test.ts` (17 tests incl. property tests) |
| Smart-Code router: deterministic taskÃ¢â€ â€™lab map, 429 cross-lab failover with zero sleep, 5xx same-lab backoff, one schema repair, circuit breaker, single deadline, abort handling | `src/agents/router.ts`, `tests/phase1/smart-code-router.test.ts` (19 tests) |
| Provenance: successes always carry evidence; failures carry no `output`; certifiable classes never resolve to local | `src/types/phase1_contracts.ts`, router tests |
| Token budget ledger: reserve/settle/release, scope binding, settle-exactly-once, live-reservation-aware caps, auto-reclaim of expired leases, L0Ã¢â‚¬â€œL4 ladder, conservative unverified clamp | `src/lib/swarm/budget-ledger.ts`, `tests/phase1/budget-ledger.test.ts` (12 tests) |
| Canonical `lessons.json` (L-001Ã¢â‚¬Â¦L-007) with verification states and atomic appends | `src/lib/swarm/lessons.ts`, `tests/phase1/swarm-memory.test.ts` (12 tests) |
| Lesson injection into every system prompt (verified-only, top 3, enveloped as untrusted memory) | `src/agents/prompts/lessons-context.ts`, `src/agents/prompts/memory-registry.ts`, `tests/phase1/memory-and-skills.test.ts` (18 tests) |
| Runtime memory composition: lessons + episodic store + skill artifacts constructed once per process | `src/lib/swarm/runtime.ts`; `/api/health` reported 3 lessons, 3 skills, 0 artifact problems |
| Episodic failure memory: deterministic 384-dim hashed embedding, JSONL store, top-k retrieval; Qdrant REST adapter behind `QDRANT_URL` | `src/lib/swarm/episodic-store.ts`, `src/lib/swarm/qdrant-store.ts`, `src/lib/swarm/store-factory.ts`, `tests/phase1/episodic-store-qdrant.test.ts` (7 tests) |
| Voyager skill registry with artifact verification | `src/lib/voyager-skills/registry.ts`: `skill:untrusted-envelope-v1`, `skill:smart-code-router-v1`, `skill:piston-polyglot-runner-v1` |
| Swarm orchestrator: independent proposals Ã¢â€ â€™ critique Ã¢â€ â€™ arbitration; evidence/alternative/risk/testable-claim validation; bounded failure codes | `src/lib/swarm/orchestrator.ts`, `tests/phase1/swarm-orchestration.test.ts` (18 tests) |
| Reflexion + lessons promotion: drafts are unverified; promotion requires a passing regression test | `src/lib/swarm/reflexion.ts` |
| DPO trajectory record with secret/PII redaction; `training_eligible` is always `false` | `src/lib/swarm/trajectory.ts`, `trajectories/phase_01_dpo.jsonl` (4 pairs) |
| Piston client: 11-outcome typed union, honest probe, per-language verification, endpoint failover, ambiguity-safe kill classification | `src/lib/piston/client.ts`, `tests/phase1/piston-client.test.ts` (25 tests) |
| Sandbox composition root: env-driven, loopback default, remote opt-in, language allowlist | `src/lib/piston/service.ts`, `tests/phase1/sandbox-service.test.ts` (8 tests) |
| Real sandboxed execution (python 3.10.0 + node 20.11.1) with enforced limits | `tests/integration/piston-live.test.ts` (5/5 live tests) |
| Read-only readiness surface | `src/app/api/health/route.ts`; live 200: verified `["javascript","python"]`, 3 lessons, JSONL store |
| Trusted prompt registry (no candidate data in system prompts) | `src/agents/prompts/index.ts`, router prompt-safety tests |
| Production build + real render | `npm run build`; page served on `:3100`; 0 console errors; contrast 18.96:1; screenshot `docs/evidence/phase1-home.png` |
| Container reproducibility | `scripts/verify-container.ps1` Ã¢â€ â€™ 165 passed / 5 skipped inside `node:20-bookworm-slim` |

---

## Phase 1 Exit Gate vs. Build Plan (`Build Plan.md` Step 1.1Ã¢â‚¬â€œ1.5)

| Step | Requirement | Status | Evidence / reason |
|---|---|---|---|
| 1.1 | `sanitizeAndWrapUntrusted` + SHA-256 digest | **MET** | `src/lib/security/untrusted-envelope.ts`, 17 tests |
| 1.1 | Bootstrap tests executed inside an isolated container | **MET** | `scripts/verify-container.ps1`, `docs/evidence/phase1-container-verify.txt` |
| 1.1 | Critic writes `L-001` from a real failing assertion | **MET** | `swarm/memory/lessons.json#L-001` |
| 1.1 | Re-run with `lessons.json` injected into the agent's system prompt | **MET** | `composeSystemPrompt`/`withLessonMemory`; `/api/health` reports 3 injected lesson ids |
| 1.1 | Promote as Voyager Skill #1 | **MET** | `src/lib/voyager-skills/registry.ts` (3 skills, artifacts verified) |
| 1.2 | 2-agent bootstrap, then an 8-agent opening swarm | **DEVIATION** | 8 read-only subagents (R1Ã¢â‚¬â€œR4, D1Ã¢â‚¬â€œD3, V1) ran, but **after** implementation, not at phase start (Ã‚Â§4 ordering violation recorded) |
| 1.2 | R1Ã¢â‚¬â€œR4, D1Ã¢â‚¬â€œD3, arbitration and a frozen contract | **MET (order deviation)** | Reports collected; arbitration applied; contract frozen with one additive v1.1 amendment |
| 1.3 | `smart-code-router`, `design-tokens`, `swarm-memory` suites (+ fast-check) | **MET** | 19 + 24 + 12 tests; fast-check in 2 suites |
| 1.4 | `Coder-Swarm`: lessons store + episodic failure store | **MET (QdrantÃ¢â€ â€™JSONL deviation)** | `lessons.ts`, `episodic-store.ts`; Qdrant adapter available but not exercised live |
| 1.4 | `Coder-Swarm`: MoA debate orchestrator, `ReflexionAgent`, lessons preloader, `VoyagerSkillRegistry` | **MET (LangGraphÃ¢â€ â€™TS deviation)** | `orchestrator.ts`, `reflexion.ts`, `memory-registry.ts`, `registry.ts` |
| 1.4 | `Coder-Router`: taxonomy, failover, Zod repair, budget, envelope | **MET** | 19 router tests, envelope composed in `router.ts` |
| 1.4 | `Coder-Router`: Ollama offline fallback | **PARTIAL** | `createOllamaTransport()` implements the transport contract; router wiring exists only via injected transports; never reached a live model |
| 1.4 | `Coder-Sandbox`: client, 3 s CPU / 128 MB caps | **MET** | 25 unit tests + 5 live tests (SIGKILL ~3.1 s, 134,216,000 B) |
| 1.4 | `Coder-Sandbox`: automatic AgentFoundry fallback | **PARTIAL** | Configurable `PISTON_FALLBACK_BASE_URLS` failover verified with a dead primary; no AgentFoundry VM exists to target |
| 1.4 | `Coder-Sandbox`: polyglot runner (Python 3.12, Java 21, C++ 20, JS/TS, SQL) | **PARTIAL** | Python 3.10.0 + Node 20.11.1 installed and probed; TS/Java/C++/SQL packages failed to install (timeouts) and are reported unsupported |
| 1.4 | `Coder-Theme`: tokens, layout, typography | **MET (font substitution)** | Tokens + self-hosted Raleway/JetBrains Mono; `Google Sans Flex` unavailable Ã¢â€ â€™ system display fallback |
| 1.5 | `tsc --noEmit && vitest run` inside a verification container | **MET** | `node:20-bookworm-slim`, 165 passed / 5 skipped |
| 1.5 | Automated Reflexion Ã¢â€ â€™ `lessons.json` on every failure | **PARTIAL** | `draftReflexion`/`promoteReflexion`/`recordReflexion` exist and are tested; no runner invokes them automatically yet |
| 1.5 | Register `skill:untrusted-envelope-v1`, `skill:smart-code-router-v1`, `skill:piston-polyglot-runner-v1` | **MET** | Registry + artifact verification + health surface |
| 1.5 | DPO trajectory appended | **MET** | 4 pairs, `training_eligible: false` (honestly not training data) |

**Unrecorded deviations needing approval:** none. QdrantÃ¢â€ â€™JSONL, LangGraphÃ¢â€ â€™TS orchestrator, AgentFoundryÃ¢â€ â€™configurable endpoint failover, `Google Sans Flex`Ã¢â€ â€™system display face, and the reduced runtime set are now recorded below.

---

## Partial / Missing / Broken / Unverified

| Item | State | Consequence |
|---|---|---|
| Sandbox host portability | **Partial** Ã¢â‚¬â€ self-hosted on this developer machine only (WSL2 + Docker); python 3.10.0 + node 20.11.1 | The gate is satisfied for local development and the demo, but nothing is deployed and four planned languages cannot execute. |
| Sandbox availability after WSL idle | **Known limitation** Ã¢â‚¬â€ the WSL VM shuts down when idle and Windows HTTP cannot wake it | `/api/health` reports degraded until `npm run sandbox:up` runs. Keep the keep-alive process running during a demo. |
| Budget ledger durability | **Partial** Ã¢â‚¬â€ in-memory only | Correct for one Node process; multi-instance would overspend. Replace behind the same interface in Phase 2. |
| SMART-Code gateway transport | **Unverified** Ã¢â‚¬â€ contract + adapter only | No credential has been exercised. Endpoint shape, model IDs and the 1,000,000-token grant remain unverified. |
| Ollama transport | **Unverified** Ã¢â‚¬â€ implemented, never reached a live daemon | Offline generation is not proven. |
| Persistence, auth, RLS | **Missing** Ã¢â‚¬â€ Phase 2 | No database exists yet; nothing candidate-facing is stored. |
| ESLint / CI | **Missing** Ã¢â‚¬â€ deferred | Gate is `tsc --noEmit && vitest run`; lint/CI is a Phase 10 dependency and must not be reported as present. |
| `Google Sans Flex` | **Unavailable** | Not publicly served; display falls back to a system face. Recorded design deviation. |
| Qdrant adapter | **Unit-tested only** Ã¢â‚¬â€ never connected to a live Qdrant | Store selection and REST shape are proven with an injected fetch; real latency/collection behaviour is unverified. |
| Product user path | **Missing** Ã¢â‚¬â€ Phase 3+ | Phase 1 exposes no candidate workflow; `/api/health` is the only server route. |

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

Runtime: eight read-only subagent invocations were made in one OpenCode session Ã¢â‚¬â€ four reconnaissance and three decision passes plus an independent verifier. They are distinct model contexts with separate prompts; they are **not** eight separately configured custom agent profiles.

| Pass | Role | Deliverable (condensed) |
|---|---|---|
| R1 | Repo / scaffold recon | Declared later-phase directories absent; `@/*` alias sound; no competing implementations |
| R2 | Token-economics recon | 1M grant unverified, 300k effective clamp, 80k/30k/4k scopes; found reused-id and cap-bypass ledger defects |
| R3 | Typography / contrast recon | Tokens exact-match Design; Google Sans Flex never served; contrast computed |
| R4 | Sandbox / memory recon | Limits match; python 3.10 Ã¢â€°Â  3.12; no AgentFoundry host; Qdrant never exercised |
| D1 | Pragmatic architect | Loopback default, failover only on infrastructure faults, executor provenance, per-endpoint probe |
| D2 | Red teamer | CatalogueÃ¢â€°Â runnable, green health while dead, 401 is configuration not candidate failure, unauthenticated executor risk |
| D3 | Reliability | Failure taxonomy (`executor_ready`/`waking`/`unreachable`/`timeout`/`unauthorized`/`rate_limited`/`catalogue_unavailable`/`execution_not_verified`) |
| V1 | Independent verifier | Re-ran the gate (136 at the time), live suite 5/5, found README stale at 84 tests and flagged unwired runtime memory |

**Ordering deviation (AGENTS Ã‚Â§4):** the swarm ran after the implementation wave instead of at phase start. It still changed the code (probe honesty, loopback default, memory-kill precedence, budget concurrency), but the phase-start decision contract was not frozen first. This is recorded, not hidden; Phase 2 must run the opening swarm before coding.

---

## Latest Decisions and Rationale

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| 1 | Nine task classes, one deterministic primary lab each; a turn cannot probe and score | Prevents a borderline prompt from silently choosing the cheaper lab and prevents an ungraded probe being shown as evidence | Five-class router split on model boundary |
| 2 | `RouteSuccess` requires `evidence`; `RouteFailure` has no `output`; `QUESTION_QC`/`RESPONSE_GRADING` may never run local | Makes provenance structurally unavoidable rather than a caller convention | Optional metadata |
| 3 | 429 Ã¢â€ â€™ other lab, zero added delay; 5xx Ã¢â€ â€™ same lab, jittered backoff (150 ms Ãƒâ€” 2, cap 1200 ms); one repair turn | A rate-limited lab stays limited; same-lab backoff burns the single deadline | Same-lab retry on 429 |
| 4 | Reserve the **completion** budget; settle actual total and report `overageTokens` | The per-call cap bounds generation; exact prompt tokens are known only after the gateway responds | Reserving prompt + completion (exceeded the 4k per-call cap) |
| 5 | Envelope order: NFKC Ã¢â€ â€™ decode Ã¢â€ â€™ strip Ã¢â€ â€™ escape | Literal-tag stripping is bypassed by `%3C`/`&#60;`/full-width forms | Regex-only closing-tag strip |
| 6 | Embedding via signed feature hashing; vectors never persisted | Zero cost, zero network, deterministic, auditable | Hosted embedding API |
| 7 | Self-host Piston under WSL2; default to loopback; remote endpoints require explicit `PISTON_ALLOW_REMOTE=1` | Public host returns 401 on execute; candidate code must not leave the machine by accident | Public `emkc.org`; silent remote fallback |
| 8 | Capability means "a probe program actually ran", not "the catalogue lists it" | A listed language can still fail at run time; a health badge must reflect execution | Catalogue-only health check |
| 9 | Lessons are injected as untrusted memory inside the envelope | Retrieved text is attacker-influenceable; it must not gain instruction authority | Pasting lessons into trusted system text |
| 10 | `killed` is a distinct outcome from `time_limit_exceeded` | A SIGKILL without a reported limit cannot be attributed to the candidate | Reporting every SIGKILL as a timeout |

---

## Tests / Commands / Runtime Evidence

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** Ã¢â‚¬â€ 0 errors |
| `npm test` (`vitest run`) | **PASS** Ã¢â‚¬â€ 12 files, 165 passed, 5 live tests skipped by design |
| `npm run verify` | **PASS** Ã¢â‚¬â€ typecheck + tests |
| `npm run build` (`next build`) | **PASS** Ã¢â‚¬â€ `/`, `/icon.svg`, dynamic `/api/health`; 103 kB first load |
| `next start -p 3100` + browser load | **PASS** Ã¢â‚¬â€ HTTP 200, 0 console messages, 0 failed requests |
| `GET /api/health` | **PASS (200)** Ã¢â‚¬â€ sandbox `verifiedLanguages: ["javascript","python"]`, executor `127.0.0.1:2000/api/v2`, 3 lessons (top-3 by confidence: L-001, L-003, L-005), 3 skills, 0 artifact problems, JSONL store, 676 ms |
| `npm run sandbox:up` | **PASS** Ã¢â‚¬â€ container up, endpoint reachable from Windows |
| `npm run test:sandbox` (`PISTON_LIVE=1`) | **PASS** Ã¢â‚¬â€ 5/5: capability authorized; Python `45`; JavaScript `45`; runaway loop Ã¢â€ â€™ `time_limit_exceeded` ~3.1 s; 400 MB Ã¢â€ â€™ exit 137 at 134,216,000 B |
| Container gate (`scripts/verify-container.ps1`) | **PASS** Ã¢â‚¬â€ `node:20-bookworm-slim`, 165 passed / 5 skipped |
| `GET https://emkc.org/api/v2/piston/runtimes` / `POST /execute` | **200** / **401** (public host is not used) |

Evidence artifacts: `docs/evidence/phase1-home.png`, `docs/evidence/phase1-container-verify.txt`, `docs/evidence/phase1-sandbox-live.txt`, `docs/evidence/phase1-health.txt`.
Decision log (not training data): `trajectories/phase_01_dpo.jsonl` Ã¢â‚¬â€ 4 preference pairs, `training_eligible: false`; no model training, fine-tuning or DPO was performed.

---

## Known Risks / Blockers / External Dependencies

1. **Sandbox is a local developer host, not a deployment** Ã¢â‚¬â€ WSL2 + Docker, two runtimes, 128 MiB / 3 s limits. The WSL VM idles out; keep-alive is required for demos.
2. **SMART-Code grant unverified** Ã¢â‚¬â€ 1,000,000 tokens specced against a ~5.2M workload; clamped to 300k while unverified.
3. **Model IDs unverified against the live gateway** (`claude-haiku-4-5`, `gpt-5-codex`) Ã¢â‚¬â€ confirm with a real call before any phase presents them as live.
4. **In-memory budget** Ã¢â‚¬â€ single-instance only.
5. **No git repository** Ã¢â‚¬â€ no commit exists; nothing has been pushed.
6. **Hackathon deadline** Ã¢â‚¬â€ cloud submission 2026-11-15, judging 2026-12-05. Nine phases remain; Phase 1 consumed the foundation budget.

---

## Scope Deviations and Approvals

| Deviation | Reason | Status |
|---|---|---|
| Added `focus: '#18181B'` as a 7th color token | `Design.md` names a focus token but omits its value | Recorded; needs reviewer sign-off |
| `Google Sans Flex` replaced by a system display face | Not publicly served; unlicensed copies are not acceptable | Recorded; needs design sign-off |
| LangGraph/DSPy replaced by a dependency-free TypeScript orchestrator | $0 budget and fewer moving parts; same proposalÃ¢â€ â€™critiqueÃ¢â€ â€™arbitration contract | Recorded; needs approval before Phase 4 orchestration work |
| Vector store defaults to JSONL; Qdrant adapter available behind `QDRANT_URL` | Fewer services at $0; adapter preserves the upgrade path | Recorded; needs approval |
| AgentFoundry replaced by ordered endpoint failover | No AgentFoundry VM/credentials exist | Recorded; defer to Phase 7 deployment decision |
| TypeScript/Java/C++/SQL runtimes not installed | Package installs timed out; only python + node verified | Recorded; Phase 6/7 dependency |
| Reflexion is a library, not an automatic failure hook | No workflow invokes it yet | Recorded; wire in Phase 2/4 |
| ESLint deferred | Not part of the Phase 1 gate | Recorded; Phase 10 dependency |
| Budget reservation covers completion only | Prompt tokens are unknown pre-call | Recorded (Decision 4) |
| Phase 1 UI limited to `/`, `/icon.svg`, `/api/health` | Route groups belong to Phase 3/4 | Recorded |

---

## Last Verified Commit / Deployment

- Commit: **none** Ã¢â‚¬â€ `git init` has not been run in `HireX-Bot`.
- Deployment: **local only** Ã¢â‚¬â€ production build served on `http://127.0.0.1:3100`; `/api/health` returned 200 at verification time.
- Verification identity: Node `v24.13.0` (host) / `node:20-bookworm-slim` (container), npm `11.6.2`, Next `15.5.28`, Vitest `2.1.9`, TypeScript `5.9.3`.

---

## Next Highest-Value Action

**Run the Phase 2 opening swarm before writing any code**, then build the persistence substrate:

1. **Approve or reject the recorded deviations** (orchestrator, vector store, host failover, fonts, runtime set). Without a decision, Phase 2 can inherit an unapproved architecture.
2. **Phase-start swarm (8 agents) + frozen contracts** for the eight-table schema, RLS/audit triggers, DPDP erase and memory substrate.
3. **Then** implement `Coder-DDL`, `Coder-Triggers-RLS`, `Coder-Memory`, `Coder-DPDP-Erase` with tests first.
4. Carry forward: replace the in-memory budget ledger behind its interface; wire Reflexion into the failure path; install remaining Piston runtimes before Phase 6/7.
