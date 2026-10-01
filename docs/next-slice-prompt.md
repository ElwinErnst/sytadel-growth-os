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
**3c-3 SecretProvider seam ✅** · **3c-4 agent-action audit ✅ (local)** ·
**3c-5 HITL approval gate ✅**. **Governance track (3c) is core complete.** No
`sytadel-suite` PR is opened without confirming scope first.

## Recommended next: pick a direction

The governance backbone is done; nothing with an external side effect runs without
a human. Reasonable next directions (confirm with the operator):

1. **Product: Slice 5 — ICP Agent** (local, no suite): refine an ideal-customer
   profile from persisted signals + the concrete hypotheses in `docs/roadmap.md`
   (B2B multi-tenant SaaS; AI-agent startups; software houses; regulated firms).
   Pure read/analysis over existing signals — a natural next Growth OS feature.
2. **Governance finish (operator/suite-touching — confirm scope first):**
   - Provision one `auth-api` ServiceAccount per agent role + enable the tenant's
     `apiAuth`, then set `GROWTH_SYTADEL_*` + `GROWTH_SYTADEL_AUTH=true`.
   - Bump the `auth-api` submodule pointer in `sytadel-suite` (meta-repo change).
   - Forward the agent-action audit trail to the suite's **unified audit
     timeline**; and audit `fetch`/`research` actions (needs an actor/run model).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
