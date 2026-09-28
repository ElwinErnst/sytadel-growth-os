# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, taxonomy, calibration), Slice 3a (hardened web fetch, SSRF),
> Slice 3b-1 (connector framework + `web_page`, research registry, resilient
> `research` run, cron), Slice 3b-2 (typed connectors: `hacker_news`,
> `github_releases`), Slice 3c-1 (opt-in Sytadel identity client), Slice 3c-2
> Growth-OS side (scope enforcement: `research:read` for analyze, `research:fetch`
> for fetch/research, via `requireScope` — the local-identity path is unchanged).
> See `docs/mvp/`.

## Slice 3c — Governance: DESIGNED (see ADR 0002)

The full governance architecture is fixed in
[`docs/adr/0002-governance.md`](adr/0002-governance.md), grounded in the verified
`auth-api` service-account token contract. Increments: **3c-1 identity ✅** ·
**3c-2 scope enforcement ✅ (Growth-OS side)** · 3c-3 Vault · 3c-4 audit · 3c-5
HITL. No `sytadel-suite` PR is opened without confirming scope first.

## Recommended next: Slice 3c-2 (suite side) — add `research:*` scopes to auth-api

> ⚠️ FIRST change that touches `sytadel-suite`. Scope already confirmed with the
> operator: add **`research:read`, `research:fetch`, `leads:read`**;
> **one ServiceAccount per agent role** (research / sales / content). Re-confirm
> before opening if anything changed.
>
> 1. In `sytadel-suite` → `auth/auth-api/src/modules/integrations/api-scopes.ts`,
>    add `research:read`, `research:fetch`, `leads:read` to the closed
>    `API_SCOPES` allowlist (unknown scopes are rejected at key creation).
>    Add/extend allowlist tests. Open as a **separate PR in `sytadel-suite`**
>    (submodule `auth-api`), following its conventions (code-only; no migration).
> 2. Provision one ServiceAccount per agent role with least-privilege scopes, and
>    enable the `apiAuth` entitlement on the tenant Growth OS runs under.
> 3. Growth OS already enforces the scopes (Slice 3c-2, this repo) — no code
>    change needed there once the grants exist; just fill the `GROWTH_SYTADEL_*`
>    credentials and set `GROWTH_SYTADEL_AUTH=true`.

## Then (each its own slice, suite-touching — confirm scope first)

- **3c-3**: secrets to Vault (unlocks Reddit / Product Hunt connectors).
- **3c-4**: agent-action audit emission to the unified timeline.
- **3c-5**: HITL approval gate (arrives with the first send/publish/spend
  capability).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
