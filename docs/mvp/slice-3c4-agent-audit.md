# Slice 3c-4 — Agent-action audit (local): spec & checklist

## Goal

Governance increment from [ADR 0002](../adr/0002-governance.md): an append-only
trail of what agents did, so runs are traceable. This slice is **local to Growth
OS** (no suite change); forwarding to the suite's unified audit timeline is a
later, suite-touching step.

## Scope

**In:**
- `AgentAuditEvent` entity + additive migration + `AuditModule`.
- `AuditService.record` — append-only and **failure-isolated** (an audit write
  never throws into / breaks the audited operation); `listByRun` /
  `listByWorkspace` / `countByWorkspace`.
- Emission from `RunOrchestrator`: `run.started` (on each execute attempt),
  `run.completed`, `run.failed`, each carrying both identities (local executor +
  Sytadel `sytadel_subject`/tenant when present) and small sanitized metadata.
- CLI `audit:list --run <id>` / `--workspace <slug>` (paginated).

**Out:** auditing `fetch`/`research` (not `AgentRun`s — a follow-up); forwarding
to the suite's unified timeline (suite-touching); HITL (3c-5).

## Design notes

- Metadata is a closed, sanitized set — started: stage/workflowVersion/
  promptVersion/provider/model; completed: stage/inputTokens/outputTokens;
  failed: stage/error (the already-sanitized `name: message`). **Never** secrets,
  tokens, or source content.
- The event entity has **no FK/relations** on purpose: the trail must survive
  even if a referenced run is removed, and it is queried by id, not joined.
- Failure isolation vs completeness: priority is "audit must not break a run", so
  `record` swallows+logs persistence errors. On a healthy DB the rows are present.
- `run.started` is emitted on every execute attempt (including resume), which
  accurately reflects each execution.

## Verification checklist

Offline suite (fixture provider + identity stub; no external network):

- [x] **Happy path** — `run.started` then `run.completed` for the run; actor =
  local executor; sytadel subject null when auth off (`audit.spec.ts`).
- [x] **Failure** — `run.started` then `run.failed`; `error` metadata is the
  sanitized name; no source content leaks (`audit.spec.ts`).
- [x] **No leak** — completed metadata keys are exactly
  `{stage,inputTokens,outputTokens}`; serialized events never contain the
  evidence content (`audit.spec.ts`).
- [x] **Sytadel attribution** — with auth on, every event carries
  `actor_sytadel_subject` + tenant (`audit.spec.ts`).
- [x] **Manual smoke** — `audit:list --run <id>` shows the two events with actor
  and sanitized metadata.

## Next

- Forward the trail to the suite's **unified audit timeline** (suite-touching →
  confirm scope first).
- Audit `fetch`/`research` actions (needs an actor/run model for them).
- 3c-5 HITL.
