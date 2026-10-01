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
**3c-3 SecretProvider seam ✅** · 3c-4 audit · 3c-5 HITL. No `sytadel-suite` PR is
opened without confirming scope first.

## Recommended next: Slice 3c-4 — agent-action audit

> Emit an append-only audit trail of agent actions, initially **local to Growth
> OS** (no suite change), so runs and their side-effecting steps are traceable.
> Later, forward to the suite's unified timeline (that step touches the suite →
> confirm scope first).
>
> 1. Model an `AgentAuditEvent` (workspace, run id, actor: local executor +
>    optional `sytadel_subject`/tenant, action type — e.g. run.started,
>    run.completed, run.failed, fetch.performed, research.collected,
>    brief.generated — timestamp, sanitized metadata). Append-only; never logs
>    secrets or raw source content.
> 2. Emit from the orchestrator/fetch/research at the right points. Keep it
>    deterministic and failure-isolated (an audit write must not break a run;
>    but a persisted run should have its audit rows).
> 3. Add a `audit:list --run <id>` / `--workspace <slug>` CLI view.
> 4. Tests: events emitted for happy path + failures; no secrets/content leak;
>    ordering stable. Consider whether hash-chaining (cf. auth/billing audit
>    chains in the suite) is worth it now or later.

## Then

- **3c-4 (suite side, later)**: forward agent-action audit to the suite's unified
  timeline — touches `sytadel-suite`; confirm scope first.
- **3c-5**: HITL approval gate (arrives with the first send/publish/spend
  capability).
- **Operator, anytime**: bump the `auth-api` submodule pointer in `sytadel-suite`
  so the suite records the merged scopes (meta-repo change — confirm first).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
