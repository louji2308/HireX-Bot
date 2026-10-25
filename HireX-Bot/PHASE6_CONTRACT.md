# Phase 6 Contract — Company Research, Blueprint Configurator & Question QC

**Status:** ACCEPTED / FROZEN
**Phase:** 6 — Module 5 Part A: 5-Tier Company Research, 7-Input Blueprint Configurator & 7-Stage Question QC Pipeline
**Date:** 2026-10-24
**Implementation contract:** src/types/phase6_contracts.ts (write-frozen during the Phase 6 coding wave)
**Supersedes:** PHASE5_CONTRACT.md for work in this phase only. Phase 5 contracts remain historical evidence for Module 4.

## 1. Re-read protocol

Read this contract before every Phase 6 implementation step, after context compaction, before any release claim, and before handing work to another agent.

If code and this contract disagree, stop. Repair the code or submit an evidence-backed amendment. Do not silently reinterpret the contract.

## 2. Governing sources

1. Product Requirements — FR-501, FR-502, FR-503.
2. Architecture — ADR-004, ADR-006, Workflow 5, Module 5 boundaries.
3. Build Plan — Phase 6.
4. Design — Screen 3.1 and relevant state/copy rules.
5. Idea — hiring-signal and preparation thesis.
6. AGENTS.md — engineering, privacy, verification, and honesty rules.

## 3. Phase mission

Ship an honest, locally verifiable Phase 6 slice that:

- researches company/role evidence into the five-tier confidence hierarchy;
- generates versioned blueprints from the seven controlling inputs across ten hiring stages;
- runs the seven-stage automated question QC pipeline;
- verifies every released coding/practical problem in Piston using a reference solution and hidden edge cases;
- renders Screen 3.1 with a 72px control bar, seven input pills, a five-tier provenance popover, and a truthful 7/7 QC badge;
- never claims live company verification, candidate-specific readiness, deployed origin, or real employer outcomes.

## 4. In scope

- src/types/phase6_contracts.ts.
- 5-tier company research with source URL, capture date, content hash, and confidence label.
- 7-input blueprint generator across ten hiring stages.
- 7-stage QC pipeline with Stage 5 Piston verification and auto-regeneration.
- Workflow C asynchronous pre-warming and caching of verified bundles.
- Screen 3.1 UI at src/app/(workspace)/interview/page.tsx and src/components/studio/BlueprintHeader.tsx.
- Local stores for blueprints and QC bundles with durable: false.
- Pure 	oInterviewBlueprintRow mapper that is tested but not invoked by request paths.
- Tests for role differentiation, QC Stage 5, company research schema, blueprint immutability, seniority guardrails, pre-warm cache, UI rendering, and fairness.

## 5. Explicit deviations and unresolved requirements

### D6-001 — Asynchronous QC, not synchronous 7-stage generation

On-demand 7-stage LLM plus Piston work can take 12-18 seconds. The interactive path must resolve a cached, verified bundle in under 400ms. On-demand generation is only an asynchronous background path.

### D6-002 — Stage 5 requires adversarial dual-test verification

A reference solution must pass all hidden edge cases, and a deliberately mutated buggy baseline must fail the same suite. Trivial suites such as ssert True are rejected.

### D6-003 — No live company verification without employer-supplied evidence

Company-specific claims must preserve source, confidence, date, and confirmed versus inferred status. Priority 5 remains "Company-Informed Simulation", not a confirmed employer standard.

### D6-004 — No candidate capability inflation

Candidate history may influence topic selection only. It must never lower Mode B/C difficulty below the employer bar.

### D6-005 — Shared blueprints are immutable

Corrections create a new blueprint version. Existing sessions remain pinned to their historical blueprint version.

### D6-006 — Phase 6 does not run simulations

Mode A/B/C selection is a blueprint selector in this phase. Simulation execution, BHASHINI, and emergency invite behavior remain Phase 7.

### D6-007 — No Supabase writes in Phase 6

Blueprint and QC persistence remains local-first. The pure row mapper is tested but not invoked.

### D6-008 — LLM absence is honest

If LLM credentials are unavailable, Stage 3 returns LLM_UNAVAILABLE, no question or reference solution is fabricated, and bundles remain 
ot_generated or unverified.

### D6-009 — Piston runtime scope

Only JavaScript and Python are live-verified. Generated problems targeting unsupported runtimes must be marked unsupported or deferred.

### D6-010 — No Apply, Dispatch, PDF, or outreach UI

Phase 6 must not expose application submission or document generation.

## 6. Frozen decisions

1. 7-stage pipeline: retrieve evidence, construct blueprint, synthesize question, audit competency, Piston reference, validate rubric, release.
2. Stage 5 is a hard gate: no release without 100% pass.
3. Pre-warm/cache is required for the under-400ms launch claim.
4. Auto-regeneration is capped at 3 attempts, then hard-reject.
5. Seniority guardrails are enforced at Stage 4 and stored as complexity bounds.
6. Rubrics use 0-5 behaviorally anchored descriptors.
7. Candidate-facing data excludes reference solutions and hidden tests.
8. Practice results are never hiring probabilities or guarantees.

## 7. Work packages and exclusive ownership

| Owner | Exclusive write paths | Read-only |
|---|---|---|
| Orchestrator | src/types/phase6_contracts.ts, PHASE6_CONTRACT.md, Progress.md | all |
| Tester-P6 | 	ests/phase6/** | all production paths |
| Coder-Evidence5T | src/agents/module5-blueprint/company-research.ts, src/lib/jina/reader.ts | contract, Piston service |
| Coder-Blueprint7I | src/agents/module5-blueprint/blueprint-generator.ts, src/lib/module5/blueprint-store.ts, data/blueprints/*.json | contract, DB types |
| Coder-QC7Stage | src/agents/module5-blueprint/qc-pipeline.ts, src/agents/module5-blueprint/piston-qc.ts, src/lib/module5/qc-store.ts, src/inngest/workflows/workflow-c-qc-prewarm.ts | contract, events |
| Coder-StudioConfigUI | src/app/(workspace)/interview/page.tsx, src/components/studio/BlueprintHeader.tsx, src/components/studio/ModeSelector.tsx | contract, design tokens |

Contract files are read-only to implementation workers during the coding wave. One writable owner per file.

## 8. Test-first plan

Tester-P6 owns 	ests/phase6/** and must write tests before implementation:

1. ole-differentiation.test.ts
2. qc-stage5-piston.test.ts
3. company-research-schema.test.ts
4. lueprint-immutability.test.ts
5. seniority-guardrail.test.ts
6. prewarm-cache.test.ts
7. ui-blueprint-header.test.ts
8. Fairness and candidate-capability invariance tests

## 9. Acceptance criteria

- 
px tsc --noEmit passes.
- 
px vitest run tests/phase6 passes.
- Stage 5 verifies reference pass and mutated baseline fail, or the blocker is documented.
- No false live-data, hiring-probability, or guarantee claims.
- UI matches Design Screen 3.1.
- Progress ledger is updated with evidence and next action.

## 10. Exit gate

- [ ] Phase-start protocol and 10-agent swarm honestly recorded.
- [ ] PHASE6_CONTRACT_VERSION frozen and referenced by all workers.
- [ ] 
pm run typecheck passes.
- [ ] 
px vitest run tests/phase6 passes.
- [ ] Stage 5 verified live in Piston or blocker documented.
- [ ] RLS reviewed for shared and candidate-scoped blueprints.
- [ ] UI matches Design Screen 3.1.
- [ ] Progress updated with evidence, commit identity, and next action.
- [ ] Git status reviewed before coding.

## 11. Approval requirements before coding

- Human approval for DB migrations or seed-data promotion beyond the existing schema.
- Human approval before enabling live Jina fetches.
- Confirmation that Piston isolation covers generated reference solutions.
- Approval for any scope deviation, including 15-employer seeding.
- No approval needed for cached or seeded local mode.
