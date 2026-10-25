# Phase 7 Contract — Mode A/B/C Simulation IDE, BHASHINI, Offline Continuity & Emergency Invite

**Status:** ACCEPTED / FROZEN
**Phase:** 7 — Module 5 Part B: Live Simulation & Evaluation Engine
**Date:** 2026-10-25
**Implementation contract:** src/types/phase7_contracts.ts (write-frozen during the Phase 7 coding wave)
**Supersedes:** PHASE6_CONTRACT.md for work in this phase only. Phase 6 contracts remain historical evidence for Module 5 Part A.

## 1. Re-read protocol

Read this contract before every Phase 7 implementation step, after context compaction, before any release claim, and before handing work to another agent.

If code and this contract disagree, stop. Repair the code or submit an evidence-backed amendment. Do not silently reinterpret the contract.

## 2. Governing sources

1. Product Requirements — FR-504, FR-505, FR-506.
2. Architecture — ADR-004, ADR-007, ADR-011, Workflow 5, Module 5 boundaries.
3. Build Plan — Phase 7.
4. Design — Screens 3.2 and 3.3, density, copy, accessibility.
5. Idea — hiring-signal and preparation thesis.
6. AGENTS.md — engineering, privacy, verification, and honesty rules.

## 3. Phase mission

Ship an honest, locally verifiable Phase 7 slice that:

- executes Mode A/B/C simulations against an immutable Phase 6 blueprint;
- adapts Mode A to declared and observed weaknesses while locking Mode B/C to the employer blueprint bar;
- grades with Piston-anchored correctness and untrusted candidate input;
- records immutable baseline deltas for the exact comparable tuple;
- provides vernacular Mode A support and offline continuity without local model execution or certifying offline runs;
- handles confirmed-round emergency overrides without fabricating employer confirmation;
- never claims live BHASHINI capability, real employer outcomes, or deployed origin without evidence.

## 4. In scope

- src/types/phase7_contracts.ts.
- Mode A/B/C controller and execution policy.
- 8-factor difficulty lock and anti-inflation guardrail.
- Piston-anchored rubric evaluator.
- Comparable baseline delta calculation.
- Append-only practice session, response, and skill-history records.
- Live Agent Replay event schema and redaction requirements.
- Offline queue and reconnect sync contract.
- Emergency override state and back-calculation.
- Screens 3.2 and 3.3 UI contracts.
- Tests for guardrails, prompt injection, baseline comparability, offline sync, emergency override, replay schema, mode policy, and fairness.

## 5. Explicit deviations and unresolved requirements

### D7-001 — Live BHASHINI and local model execution are out of scope

BHASHINI ULCA is an integration target, not a verified production dependency. Local model execution is removed from the Phase 7 plan because no local model runtime is available. Mode A must degrade to text or a deterministic fallback and report `unverified` until credentials and probes exist.

### D7-002 — Piston supports only JavaScript and Python

Problems targeting Java, C++, SQL, or TypeScript must be marked unsupported or deferred. Do not claim the broader runtime set.

### D7-003 — No LLM fabrication

If GPT-5 Codex or Claude Haiku is unavailable, grading returns llm_available: false, graded: false, and weighted_score: null. No synthetic score, prose, or completion event is produced.

### D7-004 — No offline certification

Offline sessions are buffered and remain provisional; they cannot be certified or promoted until online Piston verification and cloud grading succeed. No local model evaluation is used.

### D7-005 — No automatic Skill Passport minting

Phase 7 prepares replay traces and mode results. Phase 9 owns passport minting and public publication.

### D7-006 — No live Supabase writes by default

Append-only writes remain gated behind a verified service-role client and explicit enablement. Local-first stores report durable: false unless a real RPC succeeds.

### D7-007 — Emergency invites are not employer confirmation

Self-declared invites may create a Priority-1 sprint and pause routine training, but they cannot set Confirmed — Employer Supplied without employer-supplied evidence.

### D7-008 — No Apply, Dispatch, PDF, or outreach UI

Phase 7 must not expose application submission or document generation.

## 6. Frozen decisions

1. Mode A may adapt topics and hints; Mode B/C lock difficulty to the blueprint and never dilute it for weak history.
2. Weak history affects topic sampling only.
3. Mode A writes is_first_attempt_unassisted = false; Mode B/C write 	rue.
4. Sessions, responses, and skill history are append-only.
5. Baseline delta compares the exact (candidate_id, company_name, job_role, round_type) tuple.
6. Correctness cannot exceed 2.0/5.0 when Piston hidden tests fail.
7. Candidate code and transcripts are untrusted data and cannot override rubric caps.
8. BHASHINI assesses reasoning, not English fluency.
9. Offline Mode C runs are provisional until online verification succeeds.
10. Emergency override requires candidate ownership, rate limiting, and audit logging.
11. Practice results are never hiring probabilities or guarantees.

## 7. Work packages and exclusive ownership

| Owner | Exclusive write paths | Read-only |
|---|---|---|
| Orchestrator | src/types/phase7_contracts.ts, PHASE7_CONTRACT.md, Progress.md | all |
| Tester-P7 | 	ests/phase7/** | all production paths |
| Coder-ModeEngine | src/agents/module5-blueprint/simulation-engine.ts, src/agents/module5-blueprint/evaluator.ts, src/agents/module5-blueprint/baseline-delta.ts | contract, DB types, events |
| Coder-MonacoIDE | src/app/(workspace)/interview/[id]/page.tsx, src/components/studio/SimulationWorkspace.tsx, src/components/studio/DeltaReceiptCard.tsx | contract, design tokens |
| Coder-Bhashini | src/lib/bhashini/ulca-client.ts, src/components/studio/BhashiniVernacularBridge.tsx | contract |
| Coder-OfflineSync | `src/lib/offline/session-queue.ts`, `src/components/studio/OfflineContinuityPill.tsx` | contract |
| Coder-EmergencyInvite | src/inngest/workflows/emergency-invite-override.ts, src/components/studio/EmergencyOverrideBanner.tsx | contract, events |

Contract files are read-only to implementation workers during the coding wave. One writable owner per file.

## 8. Test-first plan

Tester-P7 owns 	ests/phase7/** and must write tests before implementation:

1. mode-calibration-guardrail.test.ts
2. prompt-injection-grading.test.ts
3. hashini-and-offline-sync.test.ts
4. aseline-delta-comparability.test.ts
5. emergency-invite-override.test.ts
6. live-replay-schema.test.ts
7. mode-execution-policy.test.ts
8. fairness and candidate-capability invariance tests

## 9. Acceptance criteria

- 
px tsc --noEmit passes.
- 
px vitest run tests/phase7 passes.
- Prompt-injection cap verified by test.
- Anti-inflation guardrail verified by test.
- Baseline comparability verified by test.
- Offline sync verified by test or blocker documented.
- UI matches Design Screens 3.2 and 3.3.
- Progress ledger is updated with evidence and next action.

## 10. Exit gate

- [ ] Phase-start protocol and 10-agent swarm honestly recorded.
- [ ] PHASE7_CONTRACT_VERSION frozen and referenced by all workers.
- [ ] 
pm run typecheck passes.
- [ ] 
px vitest run tests/phase7 passes.
- [ ] Prompt-injection cap verified by test.
- [ ] Anti-inflation guardrail verified by test.
- [ ] RLS reviewed for practice_sessions, session_responses, candidate_skill_history.
- [ ] UI matches Design Screens 3.2 and 3.3.
- [ ] Progress updated with evidence, commit identity, and next action.
- [ ] Git status reviewed before coding.

## 11. Approval requirements before coding

- Human approval to enable append-only writes to practice_sessions, session_responses, and candidate_skill_history.
 - Human approval before live BHASHINI calls.
- Confirmation that Piston isolation covers candidate-submitted code.
- Approval for any scope deviation, including deferred runtimes.
- No approval needed for cached, local, or mock mode.

## 12. Known limitations

- BHASHINI is unverified; local model execution is out of scope because no local model runtime is available. Mode A must degrade honestly.
- Piston currently supports only JavaScript and Python.
- No deployed origin or real field-impact evidence exists.
- Impact evidence must be real pilot data only; never fabricated.
