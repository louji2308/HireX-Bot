# HireX Bot

Autonomous proof-of-work, apprenticeship and employment architecture for India's first-time technology job seekers.

Built for **Code for a Billion â€” Bharat Agentic-AI Hackathon 2026**, Track 10 (Tech Employment for Youth).

> **Status: Phase 1 (cognitive swarm foundation).** There is no database, no authentication and no candidate-facing workflow yet. Nothing is deployed. See [Progress.md](Progress.md) for the verified state, evidence and open blockers.

---

## What exists today

| Area | What it does |
|---|---|
| Design foundation | Monochrome "obsidian on alabaster" tokens, Tailwind contract, self-hosted Raleway + JetBrains Mono, single-focus home route |
| Untrusted-data envelope | Sanitises resume/JD/code/web text before it can enter a prompt, and returns a SHA-256 digest for provenance |
| Smart-Code router | Deterministic task â†’ model routing across two labs, typed failures, rate-limit failover, bounded backoff, one schema repair, circuit breaker, single deadline |
| Budget ledger | Reserve / settle / release with scope binding, settle-exactly-once, live-reservation-aware caps and an L0â€“L4 conservation ladder |
| Verified memory | Append-only `swarm/memory/lessons.json`, lesson injection into every system prompt, JSONL episodic store with an optional Qdrant adapter |
| Voyager skills | Three promoted skills with documented inputs, outputs, security notes and artifact verification |
| Swarm orchestration | Independent proposals â†’ critique â†’ arbitration, with mandatory evidence and testable claims; Reflexion drafts that cannot be promoted without a passing regression test |
| Sandbox | Piston adapter with a typed outcome union, per-language probe verification, endpoint failover and a live suite proving the 3 s / 128 MiB limits |
| Readiness surface | `GET /api/health` reports the probed sandbox capability, lesson injection count, active memory store and skill artifact state |

Every successful model call returns `evidence` (source, model, tier, prompt hash, untrusted digest, schema hash, budget level). Every failure returns **no output field at all**. Tasks that can become hiring evidence (`QUESTION_QC`, `RESPONSE_GRADING`) can never be produced by the local model.

---

## Requirements

- Node.js 20+ (verified on `v24.13.0`)
- npm 10+ (verified on `11.6.2`)
- **Optional, for real code execution:** WSL2 with Docker (verified on Ubuntu 26.04, Docker 29.1.3) and the `piston` container. Nothing else in Phase 1 needs it.

No environment variables are required to run the app. Copy `.env.example` to `.env.local` if you need to change the sandbox endpoint. Do not add real credentials to the repository; `.env*` is ignored except `.env.example`.

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
```

`npm test` is fully offline: transport, clock and budget are injected, so no test performs a network call or reads a real secret. Only `npm run test:sandbox` requires the container.

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

## Layout

```
src/
  app/                      # Next.js App Router (Phase 1: /, icon, /api/health)
  agents/
    router.ts               # deterministic SMART-Code router
    prompts/                # trusted system prompts + lesson injection
  lib/
    security/untrusted-envelope.ts
    swarm/                  # lessons, episodic store, budget, orchestrator, reflexion
    voyager-skills/         # promoted skill registry
    piston/                 # sandbox client + server composition root
  types/phase1_contracts.ts # frozen Phase 1 interface (one documented amendment)
tests/                      # bootstrap/, phase1/, integration/ (opt-in live)
scripts/                    # sandbox-up.ps1, verify-container.ps1
swarm/memory/lessons.json   # verified prevention rules
trajectories/               # decision log (NOT training data)
docs/evidence/              # captured verification artifacts
```

`src/types/phase1_contracts.ts` is frozen for the Phase 1 wave. Changing it requires an evidenced change request that reviews every consumer. One additive amendment (v1.1) added `'retrieved_memory'` to `UNTRUSTED_SOURCES` so injected lessons travel through the sanctioned envelope.

---

## Verification

```bash
npm run verify        # 165 tests, 12 files, 0 failures (5 live tests skipped)
npm run build
npm run test:sandbox  # 5/5 live tests against a real executor
```

Last verified: typecheck clean, 165/165 offline tests passing, production build clean, page rendered on `:3100` with no console errors and 18.96:1 primary contrast (screenshot in `docs/evidence/phase1-home.png`). Live sandbox: real stdout for Python and JavaScript, a runaway loop killed at ~3.1 s, and a 400 MB allocation killed at 134,216,000 bytes. `GET /api/health` returned 200 with `verifiedLanguages: ["javascript","python"]`, 3 injected lessons and no skill-artifact problems.

The same suite was re-run inside a `node:20-bookworm-slim` container (`scripts/verify-container.ps1`) to show it does not depend on this machine's Node install.

---

## Known limitations

1. **The sandbox is a local developer host, not a deployment.** It runs in WSL2 + Docker on one machine, has two runtimes (python 3.10.0, node 20.11.1), and must be started with `npm run sandbox:up`. It cannot serve a deployed demo yet; only the client contract and enforcement evidence are portable.
2. **No persistence.** The budget ledger is process-local; multi-instance use would overspend. Phase 2 replaces it behind the same interface.
3. **The SMART-Code gateway is not exercised.** Model IDs and the 1,000,000-token grant are unverified; the ledger clamps to 300k and reports `grantVerified: false`. The Ollama transport exists but has never reached a live model.
4. **No lint or CI yet.** Deferred deliberately; the Phase 1 gate is typecheck + tests.
5. **`Google Sans Flex` is not publicly served**, so the display stack falls back to a system face. Raleway and JetBrains Mono are self-hosted under the OFL.
6. **Repository layout.** Git's root is the Windows home directory, so the project lives at HireX-Bot/ inside it; the remote tracks only that folder.
7. **Swarm modules are not yet on a user path.** The orchestrator and Reflexion have tests but no product workflow calls them; that arrives with the later modules.
8. **The health route is the only server surface.** It is read-only and never executes candidate code; an execution endpoint belongs behind authenticated Studio routes in Phase 7.

---

## Privacy and safety rules this code already enforces

- Candidate text is always wrapped in `<untrusted-data>` and never placed in a system prompt.
- Injected lessons are wrapped as untrusted memory; they are advisory and cannot change a role, schema or rubric.
- Instructions found inside untrusted content are treated as data, not commands.
- Logs carry identifiers, codes and counts only â€” never prompt text, model output or personal data.
- Rate limits and outages fail over; they are never reported as candidate failure.
- Local or degraded model output can never be certified as an employer-facing assessment.
