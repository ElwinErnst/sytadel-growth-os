# Slice 2 — Core hardening: spec & checklist

## Goal

Make the Slice 1 workflow usable and observable day-to-day, without adding any
external effect or schema change. Still CLI-first, still offline-testable.

## Scope

**In:**
- **Multi-evidence runs** — `analyze --evidence <id> [<id>…]` analyzes several
  sources in one run; each signal maps to the correct source; references stay
  validated.
- **Visibility / query CLI** — `workspace:list`, `workspace:show`,
  `evidence:list`, `run:list` (with `--status`), `signal:list`, `brief:list`,
  with stable ordering and `--limit`/`--offset` pagination.
- **Signal taxonomy** — expanded `SignalCategory` (adds `pricing`, `trend`,
  `positioning`, `risk`). No migration: category is a text column and the prompt
  lists categories dynamically.
- **Calibration summary** — a deterministic, model-independent block in the brief
  (signal count, fact/hypothesis split, average confidence, per-category
  breakdown), computed from persisted signals.

**Out (unchanged):** web fetch/SSRF, scheduling, HTTP endpoints, Sytadel-governed
identity, any external side effect.

One small additive migration ships in this slice: `run_evidence.position`, which
makes the order in which evidence is presented to the model deterministic and
equal to the operator-supplied order (independent of insertion timestamps).

## Design notes

- List/count methods live on the existing services (`EvidenceService`,
  `SignalService`, `BriefService`, `RunOrchestrator`, `WorkspaceService`).
- Pagination is centralized in `src/common/pagination.ts` (`toPageParams` clamps
  limit to [1,100], offset ≥ 0).
- The calibration figures come from `computeCalibration()` in the brief renderer
  — explicitly labeled "computed from the signals, not written by the model," so
  model output and computed stats never blur.

## Verification checklist

Covered by the offline suite (fixture provider, no keys):

- [x] **Multi-evidence** — a 2-evidence run produces signals that map to the
  right source id (`run.spec.ts`).
- [x] **Pagination & counts** — evidence list respects limit/offset; counts are
  correct and workspace-isolated (`query.spec.ts`).
- [x] **Run/brief listing** — lists and status filter work after a completed run
  (`query.spec.ts`).
- [x] **Pagination clamping** — limit/offset clamped and defaulted
  (`pagination.spec.ts`).
- [x] **Calibration** — counts/average/breakdown correct; empty set safe; block
  present in rendered brief (`calibration.spec.ts`).
- [x] **Existing guarantees intact** — full Slice 1 suite still green
  (47 tests total).

## Try it

```bash
npm run growth -- workspace:list
npm run growth -- workspace:show --workspace sytadel
npm run growth -- run:list --workspace sytadel --status completed --limit 5
npm run growth -- signal:list --run <run-id>
npm run growth -- brief:list --workspace sytadel
```
