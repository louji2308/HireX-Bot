# Phase 5 Contract — Opportunity Discovery & Triage

**Status:** ACCEPTED / FROZEN  
**Phase:** 5 — Module 4: Reversed-Funnel Discovery, Decoupled 5D Fit, 4-State Router  
**Date:** 2026-10-24  
**Implementation contract:** `src/types/phase5_contracts.ts` (write-frozen during the Phase 5 coding wave)  
**Supersedes:** `PHASE4_CONTRACT.md` for work in this phase only. Phase 4 contracts remain historical evidence for Module 1.

## 1. Re-read protocol

Read this contract before every Phase 5 implementation step, after any context compaction, before any release claim, and before handing work to another agent.

If code and this contract disagree, stop. Repair the code or submit an evidence-backed amendment. Do not silently reinterpret the contract.

## 2. Governing sources

Order used for this phase:

1. Product Requirements — FR-401–FR-404.
2. Architecture — ADR-001, ADR-003, ADR-009, Workflow 2, Module 4 boundaries.
3. Build Plan — Phase 5.
4. Design — Screen 2.1 and the relevant state/copy rules.
5. Idea — reversed-funnel thesis.
6. AGENTS.md — engineering, privacy, verification, and honesty rules.

Where these conflict, the conflict is recorded in section 5 rather than silently resolved.

## 3. Phase mission

Ship an honest, locally verifiable triage slice that:

- reads a completed Module 1 local intake profile;
- loads a small, dated set of **captured public job-board snapshots**;
- applies a deterministic eligibility check, a transparent declared-skill overlap score, and a high-precision opportunity-quality scan;
- stores all five dimensions separately;
- routes every job through one total, versioned 4-state function;
- renders the four-state triage board with a compact five-dimension inspector;
- never claims live ingestion, verified evidence, interview readiness, application dispatch, or employer outcomes.

The user outcome is: **“I can inspect real opportunity sources, understand why a role is routed where it is, and see what is missing without being told I am unqualified.”**

## 4. In scope

- `src/types/phase5_contracts.ts` and a strict snapshot schema.
- Seven captured public snapshots from Greenhouse and Ashby, with source URL, capture date, source update date, excerpt, normalized requirements, and provenance.
- Deterministic normalization and candidate-scoped dedupe.
- Candidate constraints adapter from the Phase 4 local intake session.
- Deterministic five-dimension assessment:
  - Mandatory eligibility: `pass | fail | unknown`.
  - Role fit: 0–100 declared-skill overlap.
  - Evidence strength: `not_assessed` in this phase.
  - Interview readiness: `not_assessed` in this phase.
  - Opportunity quality: `pass | fail | needs_review`.
- Total 4-state router with explicit precedence and reason codes.
- Local file store keyed by intake session; no Supabase writes.
- `GET /api/opportunities`, `POST /api/opportunities/discover`, `POST /api/opportunities/[pipelineId]/save`, `DELETE /api/opportunities`.
- `/opportunities` board with 4 state filters, compact 5D pills, master-detail inspector, mobile layout, keyboard focus, and explicit sample/snapshot/local-only labels.
- Tests for schemas, scoring, routing, fairness invariance, quality scanning, store erase, and route guards.

## 5. Explicit deviations and unresolved requirements

These are deliberate, recorded deviations. They must remain visible in the UI and Progress ledger.

### D5-001 — Snapshot ingestion, not live multi-channel ingestion

FR-402 names NCS, AICTE, Unstop, Internshala, Apna, Naukri/Indeed/LinkedIn via JobSpy, and public ATS JSON. This phase ships only a small captured set of public Greenhouse/Ashby listings.

Reasons: no JobSpy install, no Jina access, no approved headless browser, no verified ToS coverage for every portal, no durable cron/Inngest function, and no authenticated LinkedIn path. A scraper that cannot be run or verified must not be claimed.

**Not implemented:** cron, four-hour refresh, JobSpy, Jina Reader, NCS, AICTE, Unstop, Internshala, Apna, Naukri/Indeed/LinkedIn ingestion, global cross-candidate dedupe.

### D5-002 — State 1 is intentionally unreachable in this slice

Evidence strength and interview readiness require Module 2/3 artifacts and Module 5–7 sessions. Those modules do not exist and their source tables are empty. Representing either dimension as `0` would treat missing evidence as low ability. Representing a score would fabricate evidence.

**Decision:** both dimensions are `not_assessed` with `value: null`. State 1 requires measured evidence and readiness, so no listing can receive State 1 in Phase 5. The UI explains this rather than showing a fake top state.

### D5-003 — State 3 is “Prepare and revisit,” not “Cooldown Protected”

No current source provides a reliable employer-level six-month cooldown. The Design label “Cooldown Protected” would assert a protection the system cannot verify.

**Decision:** internal state remains `State_3`; the candidate-facing label is **“Prepare and revisit”**. Any sprint is “planned, not scheduled” because Module 2/3 is absent. Do not claim a matched apprenticeship.

### D5-004 — No application/resume/outreach execution

Module 7 is not built. The board may show a **preparation plan** with unavailable steps, but it must not render “Approve & Dispatch,” “Submit application,” “Send outreach,” “PDF ready,” or “Applied.”

The only candidate actions are: open the original public listing, save the role to the local plan, and start/complete Module 1 intake.

### D5-005 — Local-only persistence

`FileOpportunityStore` is `durable: false`. It is scoped by the local intake session cookie and writes under `.hirex-local/opportunities/`. It is not authenticated, not multi-tenant, and not a substitute for Supabase RLS.

The onboarding delete route also erases the matching local opportunity store. A shared browser remains a disclosed risk.

### D5-006 — Five dimensions, not five LLM scores

Role fit is deterministic declared-skill overlap, not semantic evaluation and not proof of skill. Eligibility and quality are deterministic rule results. No LLM is called.

### D5-007 — No DPO/DSPy/LoRA checkpoint

The Build Plan’s mid-build checkpoint requires real trajectories, compute, and before/after evaluation. None exist. This phase does not train, fine-tune, or claim a learning checkpoint.

### D5-008 — Route group and screen scope

The repository uses `src/app/(workspace)`, not the Build Plan’s `(candidate)` group. Adding both would create duplicate `/opportunities` routes. This phase uses `(workspace)` and Screen 2.1 only; Screen 2.2 remains out of scope.

## 6. Frozen domain decisions

### 6.1 Candidate input boundary

Only these candidate facts enter scoring:

- confirmed or declared target roles;
- declared stack and extracted claimed skills;
- locations;
- work mode;
- accepted employment types;
- compensation floor;
- joining window;
- relocation willingness;
- confirmed graduation year and degree, when present.

These never enter role fit, evidence, readiness, or quality, and must not be present in the scoring payload:

- name, email, phone, college name, college tier;
- preferred language;
- autonomy level;
- gender or any other protected attribute;
- self-reported struggle, confidence, or wellbeing signals;
- consent records;
- full resume text.

`college_tier` and `preferred_language` must not change any dimension or decision state. Tests enforce zero variance.

### 6.2 Eligibility

`EligibilityResult.status` is one of:

- `pass` — no confirmed hard conflict. This is not a guarantee of employer acceptance.
- `fail` — a confirmed hard conflict exists, such as an explicit minimum experience above the candidate’s evidence, an unaccepted location, an unaccepted work mode, or an unaccepted employment type.
- `unknown` — a hard constraint exists but the candidate or listing data is insufficient to evaluate it.

Rules:

- Missing degree/batch data is `unknown`, never a fail.
- `not_sure` compensation is not a fail.
- Internship stipends and annual CTC are normalized before comparison; do not compare ₹15k/month to ₹3.5 LPA directly.
- Location aliases are normalized (`Bengaluru`/`Bangalore`; `Gurgaon`/`Gurugram`).
- `anywhere_india` accepts all India locations; `remote_india` accepts remote roles.
- Relocation false rejects a confirmed different city, but not an unknown location.
- Explicit 3+ years against a fresher profile is a confirmed fail.
- Unknown eligibility routes to State 2 with a confirmation action; it must never become State 4.

### 6.3 Role fit

- Input is the canonical skill vocabulary only.
- Score: 80% core coverage + 20% preferred coverage, rounded.
- If core is empty, the dimension is `not_assessed`, not 100.
- Missing core skills are reported separately from missing preferred skills.
- The label must say **“Declared skill overlap; not verified.”**
- Token matching is boundary-aware: `java` must not match `javascript`; `sql` must not match `nosql`; `c++`/`c#` are distinct.
- A low role-fit score is not a claim about the candidate’s ability.

### 6.4 Evidence and interview readiness

- `status: 'not_assessed'`, `value: null`.
- Reason: `source_module_absent`.
- UI renders “Not assessed” and explains which module is required.
- No `0`, no `100`, no guessed score.
- `not_assessed` never becomes State 4.

### 6.5 Opportunity quality

`OpportunityQualityResult.status` is `pass | fail | needs_review`.

- `fail` only for high-confidence, explicit predatory language: training fee, registration fee, security deposit, pay-for-job, refundable deposit.
- `needs_review` for ambiguous bond/service-agreement/penalty language.
- Negations must be handled: “no training fee,” “fee reimbursed,” “bond not applicable” are not failures.
- Normalize Unicode, zero-width characters, and bidi controls before scanning.
- Store the matched rule, severity, and a short quote. Do not store unnecessary recruiter PII.
- Never display “Zero-Bond Verified.” Allowed copy: “No fee/bond phrase found in the captured excerpt.”
- Missing closing date is not a quality failure. It is a provenance/freshness limitation.

### 6.6 Router (ordered, total, versioned)

`router_version = 'phase5.router.v1'`

Precedence:

1. Incomplete required routing input → refuse; no row.
2. Confirmed eligibility fail → `State_4`.
3. Confirmed quality fail → `State_4`.
4. Role fit `< 65` → `State_3`.
5. Eligibility `unknown` or quality `needs_review` → `State_2` with `confirmation_required`.
6. Evidence and readiness are measured, role fit `>= 75`, evidence `>= 70`, readiness `>= 70` → `State_1`.
7. Role fit `>= 65` → `State_2`.
8. Otherwise → `State_3`.

Consequences:

- `State_1` is unreachable while evidence/readiness are unassessed.
- `not_assessed` never causes State 4.
- A missing preferred skill never blocks State 2.
- Lowering role fit cannot improve the state.
- Every complete input produces exactly one state.
- The Build Plan phrase “missing preferred skill always State 2” is interpreted as “never below State 2”; it does not override the eligibility/quality gates.

### 6.7 Event and persistence boundary

- No `application/state.routed` event is emitted.
- No Inngest function is registered or claimed.
- The local assessment retains `event_intent: 'application/state.routed'` with `emitted: false` for traceability only.
- `toEmploymentPipelineRow()` maps the local result to the frozen Phase 2 shape for future integration, but is never invoked to write Supabase in this phase.
- The DB RPC can only raise the state rank and cannot downgrade `State_4`; this is why high-confidence quality failures only may persist as `State_4`.

## 7. Frozen contracts

`src/types/phase5_contracts.ts` owns:

- `PHASE5_CONTRACT_VERSION = 'phase5.discovery.v1'`
- `PHASE5_SNAPSHOT_SCHEMA_VERSION = 'phase5.snapshot.v1'`
- `PHASE5_ROUTER_VERSION = 'phase5.router.v1'`
- `PHASE5_SCORING_VERSION = 'phase5.role-fit.v1'`
- `PHASE5_QUALITY_RULES_VERSION = 'phase5.quality.v1'`
- `DecisionState = 'State_1' | 'State_2' | 'State_3' | 'State_4'`
- `EligibilityResult`, `RoleFitResult`, `NotAssessedDimension`, `OpportunityQualityResult`
- `FitScores5D`
- `OpportunitySnapshot`
- `CandidateRoutingInput`
- `OpportunityAssessment`
- `OpportunityWorkspace`
- `OpportunityBoardResponse`

No other Phase 5 module may invent a second vocabulary, state string, score shape, or event payload.

## 8. Work packages and ownership

| Package | Owner | Writable paths |
|---|---|---|
| Contract and core domain | Orchestrator | `PHASE5_CONTRACT.md`, `src/types/phase5_contracts.ts`, `src/agents/module4-discovery/**`, `src/lib/opportunities/**` |
| Snapshots and provenance | Orchestrator | `data/opportunity-snapshots/**` |
| Local store and API | Orchestrator | `src/lib/opportunities/**`, `src/app/api/opportunities/**` |
| Triage UI | Orchestrator | `src/components/opportunities/**`, `src/app/(workspace)/opportunities/page.tsx` |
| Tests | Orchestrator | `tests/phase5/**` |
| Integration touchpoint | Orchestrator | `src/app/api/onboarding/session/route.ts` (erase only) |

No worker may edit `src/types/phase4_contracts.ts`, `src/types/phase3_contracts.ts`, or the Supabase schema in this phase.

## 9. Test-first plan

Required suites:

1. `snapshot-schema.test.ts` — accepts captured snapshots; rejects non-http URLs, missing provenance, unknown fields, and malformed skill lists.
2. `five-d-scoring.test.ts` — core/preferred math, boundary-aware tokens, empty-core handling, `not_assessed` semantics.
3. `eligibility.test.ts` — degree unknown, batch unknown, stipend/CTC normalization, location aliases, `anywhere_india`, relocation, 3+ years vs fresher.
4. `quality-scan.test.ts` — fees/deposits fail; negations and reimbursements pass; bond → needs_review; zero-width and Devanagari text; no “verified” claim.
5. `router.test.ts` — property test over arbitrary complete tuples: exactly one state; eligibility/quality fail always State 4; `not_assessed` never State 4 or State 1; role-fit monotonicity; 64/65/74/75 boundaries.
6. `fairness.test.ts` — vary name, college tier, language, and injected gender; deep-equal dimensions and state; scoring payload allowlist excludes identity fields; 500 property runs.
7. `dedupe.test.ts` — same source ID merges; same title/company/location with different source IDs stays separate; zero-width company does not merge.
8. `file-store.test.ts` — atomic write, candidate scoping, save update, erase, invalid IDs rejected.
9. `routes.test.ts` — no session returns empty; preview is synthetic and labelled; discover rejects cross-origin and incomplete intake; save requires cookie; delete erases only the matching store.
10. `triage-view.test.tsx` — static markup asserts state labels, 5D “Not assessed,” snapshot/sample disclosures, and absence of Apply/Dispatch/PDF/sent claims.

Commands:

```powershell
npx vitest run tests/phase5
npm run typecheck
npm test
npm run build
```

## 10. Security, privacy, fairness, and cost checks

- No secrets, tokens, email content, full resume text, or candidate name in snapshots, logs, or UI.
- Snapshot schema permits only http(s) URLs and bounded text lengths.
- Untrusted listing text is never treated as instructions.
- The scoring payload is structurally allowlisted; identity fields are absent by type.
- The local store is `0700`/`0600`, atomic, session-scoped, and erased with the intake draft.
- No external network call occurs at request time.
- No paid dependency or live API is introduced.
- No claim of TrustModel, four-fifths certification, or a completed bias audit.
- Role-fit and quality results are heuristics and must say so.

## 11. Acceptance criteria

- [ ] The four state filters render counts and are keyboard accessible.
- [ ] The compact list and inspector show all five dimensions separately.
- [ ] Missing evidence/readiness is rendered as “Not assessed,” never 0 or “low.”
- [ ] Eligibility/quality failures route to State 4 with a specific, non-dehumanizing reason.
- [ ] `needs_review` and unknown eligibility route to State 2, not State 4.
- [ ] No state is reachable without a complete routing input.
- [ ] Captured snapshots display source, capture date, source update date, and “not live.”
- [ ] Preview mode displays a sample-candidate label.
- [ ] No Apply/Dispatch/PDF/outreach claim exists in the UI.
- [ ] Local save works; local erase removes the matching workspace.
- [ ] Fairness invariance tests pass.
- [ ] Phase 5 tests, typecheck, full suite, and build pass.
- [ ] Progress ledger records the verified counts and explicit limitations.

## 12. Exit gate

Phase 5 may be marked **verified locally** only when:

- all acceptance criteria above are checked with captured command output;
- the nine Phase 5 suites pass;
- the full suite has no new failures;
- `npm run typecheck` and `npm run build` pass;
- `Progress.md` accurately reports snapshot-only ingestion, State 1 unreachable, local-only persistence, no Inngest/LLM/DB writes, and no DPO checkpoint.

Phase 5 must **not** be marked complete for FR-402 end-to-end, live discovery, durable routing, or application execution.

## 13. Rollback

Revert the Phase 5 paths listed in section 8 and restore `src/app/(workspace)/opportunities/page.tsx` to the prior placeholder. The local store directory can be deleted with `.hirex-local/opportunities`. No database migration is involved, so rollback has no schema effect.
