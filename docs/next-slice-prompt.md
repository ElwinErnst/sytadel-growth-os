# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, taxonomy, calibration), Slice 3a (hardened web fetch, SSRF),
> Slice 3b-1 (connector framework + `web_page`, research registry, resilient
> `research` run, cron), Slice 3b-2 (typed connectors: `hacker_news`,
> `github_releases`), Slice 3c-1 (opt-in Sytadel identity client), Slice 3c-2
> (scope enforcement in Growth OS + `auth-api` `research:*`/`leads:read` allowlist
> PR merged — auth-api #19), Slice 3c-3 (`SecretProvider` seam, env-backed;
> secrets removed from the config object). See `docs/mvp/`.

> **Operator provisioning still pending for 3c-2 runtime:** one `auth-api`
> ServiceAccount per agent role (research/sales/content) with least-privilege
> scopes + enable the tenant's `apiAuth`, then set `GROWTH_SYTADEL_*` +
> `GROWTH_SYTADEL_AUTH=true`. (No code needed — enforcement + grants already exist.)

## Slice 3c — Governance: DESIGNED (see ADR 0002)

The full governance architecture is fixed in
[`docs/adr/0002-governance.md`](adr/0002-governance.md), grounded in the verified
`auth-api` service-account token contract. Increments: **3c-1 identity ✅** ·
**3c-2 scope enforcement ✅** (Growth-OS + `auth-api` allowlist PR merged) ·
**3c-3 SecretProvider seam ✅** · **3c-4 agent-action audit ✅ (local)** · 3c-5
HITL. No `sytadel-suite` PR is opened without confirming scope first.

## Recommended next: Slice 3c-5 — HITL approval gate

> Model a human-in-the-loop approval gate so any future action with an external
> side effect (send / publish / spend) is blocked until a human approves — this
> is the invariant that outranks any scope grant. There is no such action yet, so
> 3c-5 builds the MECHANISM and proves it with a representative gated action.
>
> 1. Model an `ApprovalRequest` (workspace, requested action + sanitized params,
>    status pending/approved/denied/expired, requester identity, decider, decided
>    at, optional expiry). Append-only decisions; persisted.
> 2. A gate service: proposing an action persists a pending request and STOPS;
>    executing requires an approved request; denials/expiries are terminal. No
>    autonomous execution, ever.
> 3. CLI: `approval:list`, `approval:approve --id <id>`, `approval:deny --id <id>`
>    — and a representative gated action to demonstrate the flow end-to-end (pick
>    the smallest safe one; do NOT build real outbound).
> 4. Emit audit events for propose/approve/deny/execute (reuse `audit`).
> 5. Tests: propose→pending (no execution); execute-before-approval rejected;
>    approve→executable; deny/expire terminal.

## Then (later, suite-touching — confirm scope first)

- Forward the agent-action audit trail to the suite's **unified audit timeline**.
- Audit `fetch`/`research` actions (needs an actor/run model for them).
- **Operator, anytime**: bump the `auth-api` submodule pointer in `sytadel-suite`
  so the suite records the merged scopes (meta-repo change — confirm first), and
  provision one SA per agent role + enable the tenant's `apiAuth`.

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
