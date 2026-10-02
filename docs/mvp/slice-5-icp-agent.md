# Slice 5 — ICP Agent: spec & checklist

## Goal

Synthesize a **versioned Ideal Customer Profile** for a workspace from its
market signals — the first ICP/Opportunity track feature. Local, read/analysis
only; deterministic around the model, grounded in signals.

## Scope

**In:**
- `IcpProfile` entity (workspace, version, title, structured content, rendered
  Markdown, source signal count) + migration; `SignalService.listByWorkspace`.
- `IcpWorkflow` (versioned prompts + zod `icpOutputSchema`), `IcpService.generate`
  (gather workspace signals → synthesize → map `signalRefs` → ids with
  reference-integrity → version → render → persist), `IcpModule`, renderer.
- Scope-gated (`research:read` when Sytadel auth is on) + audited
  (`icp.generated`).
- CLI `icp:generate` / `icp:show [--version]`.

**Out:** opportunity scoring / lead gen (Slice 6+); multi-workspace; editing an
ICP in place (new runs produce new versions).

## Design notes

- The ICP spans **all** of a workspace's signals (cross-run), capped at the 100
  most recent. `signalRefs` are 1-based into that ordered list; out-of-range refs
  are rejected (the model can't invent citations) — same discipline as signals
  and briefs.
- Versioned per workspace (`uq_icp_workspace_version`); each `generate` creates
  the next version, so history is preserved and `icp:show` defaults to latest.
- Respects fact/hypothesis labeling: hypothesis-backed claims belong under
  `hypothesesToValidate`/`uncertainty`, not asserted as fact (enforced by the
  prompt; the signals carry the labels).
- The scope check runs **before** the signal lookup, so an unauthorized principal
  is rejected regardless of workspace state.

## Verification checklist

Offline suite (fixture provider + identity stub; no external network):

- [x] **Grounded synthesis** — segments' `signalIds` map to real workspace
  signals; version 1; markdown rendered; `icp.generated` audited (`icp.spec.ts`).
- [x] **Invented ref rejected** — out-of-range `signalRef` → `ReferenceIntegrityError`
  (`icp.spec.ts`).
- [x] **Versioning** — successive generates yield v1, v2; latest = v2
  (`icp.spec.ts`).
- [x] **No signals** — empty workspace → `NoSignalsError` (`icp.spec.ts`).
- [x] **Scope denied** — principal without `research:read` → `ScopeDeniedError`
  before any signal lookup (`icp.spec.ts`).
- [x] **Manual smoke** — `analyze` → `icp:generate` (v1) → `icp:show` renders a
  grounded ICP.

## Try it

```bash
npm run growth -- analyze --workspace sytadel --file <ev.md> --source-url <url> --source-name S --retrieved-at <iso>
npm run growth -- icp:generate --workspace sytadel
npm run growth -- icp:show      --workspace sytadel
```
