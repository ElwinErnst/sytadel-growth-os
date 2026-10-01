# Slice 3c-5 — HITL approval gate: spec & checklist

## Goal

The final governance increment from [ADR 0002](../adr/0002-governance.md): a
human-in-the-loop gate so any action with an external side effect
(send / publish / spend) is **blocked until a human approves it** — the invariant
that **outranks any scope grant**. No such action exists yet, so this slice builds
the MECHANISM and proves it with a representative, **simulated** gated action.

## Scope

**In:**
- `ApprovalStatus` (pending/approved/denied/expired) + `ApprovalAction` enums;
  `ApprovalRequest` entity + additive migration; `ApprovalsModule`.
- `ApprovalService`: `propose` (persists PENDING, stops), `approve`/`deny`
  (pending-only), `requireApproved` (the execution gate), `markExecuted`
  (no-replay), lazy expiry, audit emission (propose/approve/deny).
- Representative gated action — **simulated brief delivery** (no real outbound):
  `brief:request-delivery` (propose + stop) and `brief:deliver --approval <id>`
  (requires approval → simulated delivery → mark executed → `brief.delivered`
  audit). CLI `approval:list/approve/deny`.

**Out:** any REAL outbound/publish/spend; forwarding audit to the suite timeline;
operator provisioning. These are not Growth OS features.

## Design notes

- The gate is the contract: `requireApproved(id, action)` succeeds only for an
  APPROVED, un-executed request of the expected action; `markExecuted` pins it so
  an approval can't be replayed. Denied/expired are terminal.
- Expiry is lazy (flipped on read), so no scheduler is needed.
- Approval lifecycle is audited (reuses Slice 3c-4). Audit `run_id` is only linked
  when a param is a real UUID (the audit column is uuid-typed) — otherwise null.
- The delivery is explicitly **simulated** and labeled as such; Growth OS performs
  no network I/O. This proves the gate without crossing the "no side effects" line.

## Verification checklist

Offline suite (no external network):

- [x] **Propose → PENDING, not executable** (`approvals.spec.ts`).
- [x] **Approve → executable exactly once** (no replay after `markExecuted`)
  (`approvals.spec.ts`).
- [x] **Denied terminal** + cannot re-decide (`approvals.spec.ts`).
- [x] **Lazy expiry** flips stale pending to EXPIRED (`approvals.spec.ts`).
- [x] **Action mismatch rejected** (`approvals.spec.ts`).
- [x] **Audit emitted** for propose + approve (`approvals.spec.ts`).
- [x] **Manual E2E smoke** — propose (pending) → deliver rejected → approve →
  deliver (simulated) → deliver again rejected (no replay).

## Governance track: core complete

With 3c-5, the governance core (identity · scopes · secrets · audit · HITL) is
done in Growth OS. Remaining governance work is operator/suite-side (provision
SAs, bump the suite submodule pointer, forward audit to the unified timeline) —
not new Growth OS features.
