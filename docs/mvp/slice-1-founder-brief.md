# Slice 1 — Founder Brief MVP: spec & checklist

## Goal

A single, deterministic, CLI-driven workflow:

```
manual evidence -> persisted evidence -> structured signals -> Founder Brief
```

producing an evidence-backed brief that separates facts, hypotheses,
recommendations, and uncertainty.

## Scope

**In:** manual evidence ingestion; LLM analysis → market signals; brief
generation from persisted signals; run state machine with resume; idempotency &
dedup; per-run token budget; workspace isolation; CLI to run/inspect/export;
Postgres + explicit migration; offline tests + CI.

**Out (documented as future):** web fetch/URL download (SSRF controls),
scheduling, HTTP data endpoints, Sytadel-governed identity, any external side
effect (send/publish/spend).

## Domain model

- **Workspace** — isolation boundary (unique slug).
- **SourceEvidence** — operator-supplied; `provenance = manual`; URL/date are
  *declared*, not fetched; dedup per workspace by `content_hash`.
- **AgentRun** — one workflow execution; records workspace, **local executor
  identity** (distinct from Sytadel identity), agent role, workflow & prompt
  versions, provider, model, status, stage, start/finish, token usage, sanitized
  error. Unique `(workspace_id, idempotency_key)`.
- **RunEvidence** — the evidence set supplied to a run (what signals may cite).
- **MarketSignal** — structured claim; category + kind (fact vs hypothesis) +
  confidence; **must reference evidence supplied to the run in the same
  workspace**; dedup per run by `fingerprint`.
- **FounderBrief** — one per run; built only from persisted signals; structured
  content + rendered Markdown.

## Processing contract

1. Validate & persist evidence (idempotent).
2. Analysis step: fixed versioned prompt → model → parse + schema-validate.
3. Persist signals, mapping `evidenceRef` → real evidence id; reject invented or
   cross-workspace references; dedup by fingerprint.
4. Brief step: from persisted signals only → model → parse + schema-validate;
   map `signalRefs` → real signal ids.
5. Persist brief; render Markdown; allow show/export.
6. Every stage persisted; failures → `FAILED` with a sanitized error.

## Brief must contain

Findings (with evidence references) · implications for Sytadel · hypotheses to
validate · suggested next experiment · uncertainty & coverage limits.

## Verification checklist (§9)

All covered by the offline test suite (fixture provider, no keys) unless noted.

- [x] **Persistence after restart** — data survives a fresh DB connection
  (`run.spec.ts` "durability"); manual: `docker compose restart` then `run:show`.
- [x] **Deduplication & concurrency** — parallel identical ingests → one row
  (`evidence.spec.ts`); identical signals within a run → one row (`run.spec.ts`).
- [x] **Workspace separation** — identical content isolated across workspaces;
  cross-workspace evidence lookup returns null (`evidence.spec.ts`).
- [x] **Reject invented / cross-workspace references** — out-of-range
  `evidenceRef` and mismatched workspace both rejected (`run.spec.ts`,
  `signal.spec.ts`).
- [x] **Invalid model responses** — non-JSON / schema-violating output → run
  FAILED, nothing persisted (`run.spec.ts`, `json.spec.ts`).
- [x] **Timeouts & partial failures** — wall-clock deadline + bounded retries
  (`llm-runner.spec.ts`); partial failure leaves signals but no brief
  (`run.spec.ts`).
- [x] **Adversarial source content** — instructions inside evidence are fenced as
  untrusted DATA; the untrusted-data rule is in the system prompt
  (`prompts.spec.ts`).
- [x] **Brief reference fidelity** — every finding's signal ids map to real
  signals of the run (`run.spec.ts` happy path).
- [x] **Interrupted-run recovery** — a partially-failed run resumes and completes
  the brief without re-running analysis (`run.spec.ts` resume).
- [ ] **Real-provider run** — optional, gated on `ANTHROPIC_API_KEY` + a small
  budget; not required for offline verification.

## Commands (reproducible)

```bash
npm ci
cp .env.example .env
docker compose up -d growth-postgres
npm run migration:run
GROWTH_LLM_PROVIDER=fixture npm run growth -- analyze \
  --workspace sytadel --file test/fixtures/sample-evidence.md \
  --source-url https://example.com --source-name "Sample" \
  --retrieved-at 2026-09-20T00:00:00Z
npm run growth -- brief:show --run <run-id>
npm run typecheck && npm run build && npm test
```
