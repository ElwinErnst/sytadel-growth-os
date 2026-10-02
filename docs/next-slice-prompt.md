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

> **Also done:** Slice 5 — ICP Agent (versioned ICP synthesized from a
> workspace's signals; `icp:generate`/`icp:show`; scope-gated + audited).

## Recommended next: pick a direction

Governance core is done and ICP has shipped. Reasonable next directions:

1. **Product: Slice 6 — Lead Generation + Account Research** (local parts first).
   Model companies/accounts and research them against the ICP. The research
   fetches MUST go through the hardened fetcher (SSRF) and the research:fetch
   scope; keep contacts/outbound OUT (outbound is HITL-gated, later). Start with
   the local data model + scoring against the latest `IcpProfile`; defer any
   fetch-heavy enrichment to a follow-up.
2. **Product: Slice 7 — Qualification/scoring** → the funnel report
   ("N analyzed / M match ICP / K strong signals…"). Pure read/analysis; natural
   companion to ICP.
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
