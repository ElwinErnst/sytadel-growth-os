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

> **Also done:** Slice 5 — ICP Agent; Slice 6 (core) — Account Research +
> ICP-fit scoring (`account:add/list/score/show`; grounded, scope-gated,
> audited). The suite now tracks Growth OS as a **submodule** (public repo,
> PolyForm Strict).

## Recommended next: pick a direction

1. **Slice 6b — automated lead discovery/enrichment** (local → fetch). Use the
   existing connectors/hardened fetcher (+ `research:fetch` scope) to discover
   and enrich candidate accounts instead of hand-entering notes. Still no
   contacts, no outbound. Each enriched fact must be evidence-backed.
2. **Slice 7 — Qualification funnel report** (local, read-only). Aggregate the
   latest account assessments into the funnel view ("N accounts / M strong / K
   medium…") against the latest ICP. Natural companion to Slice 6.
3. **Slice 8 — Customer Discovery** (local). Structured interview capture
   (problem/company/role/current_solution/pain/budget/urgency/competitor/
   feature/objection) + pattern analysis.
3. **Governance finish (operator/suite-touching — confirm scope first):**
   - Provision one `auth-api` ServiceAccount per agent role + enable the tenant's
     `apiAuth`, then set `GROWTH_SYTADEL_*` + `GROWTH_SYTADEL_AUTH=true`.
   - Bump the `auth-api` submodule pointer in `sytadel-suite` (meta-repo change).
   - Forward the agent-action audit trail to the suite's **unified audit
     timeline**; and audit `fetch`/`research` actions (needs an actor/run model).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
