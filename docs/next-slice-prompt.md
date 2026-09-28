# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, taxonomy, calibration), Slice 3a (hardened web fetch, SSRF),
> Slice 3b-1 (connector framework + `web_page`, research registry, resilient
> `research` run, cron), Slice 3b-2 (typed connectors: `hacker_news`,
> `github_releases`), Slice 3c-1 (opt-in Sytadel identity client — authenticate as
> a ServiceAccount, record `sytadel_subject`, feature-flagged, no suite changes).
> See `docs/mvp/`.

## Slice 3c — Governance: DESIGNED (see ADR 0002)

The full governance architecture is fixed in
[`docs/adr/0002-governance.md`](adr/0002-governance.md), grounded in the verified
`auth-api` service-account token contract. Increments: **3c-1 identity ✅** ·
3c-2 scopes · 3c-3 Vault · 3c-4 audit · 3c-5 HITL. No `sytadel-suite` PR is opened
without confirming scope first.

## Recommended next: Slice 3c-2 — `research:*` scopes (FIRST `sytadel-suite` PR)

> ⚠️ This is the first change that touches `sytadel-suite`. **Confirm scope with
> the operator before opening the suite PR** (per ADR 0001 / ADR 0002).
>
> 1. In `sytadel-suite` → `auth/auth-api/src/modules/integrations/api-scopes.ts`,
>    add `research:read` and `research:fetch` to the closed `API_SCOPES` allowlist
>    (unknown scopes are rejected at key creation, so they must exist before a
>    ServiceAccount can hold them). Add/extend allowlist tests. Open as a
>    **separate PR in `sytadel-suite`** (submodule `auth-api`), following its
>    conventions (code-only; no migration).
> 2. In Growth OS: `SytadelIdentityService` already parses the granted scopes; add
>    a capability check so research actions assert the principal holds
>    `research:fetch` when Sytadel auth is enabled. The local-identity path stays
>    unchanged, and existing local guards are NOT bypassed.
> 3. Tests: scope-present vs scope-absent via the identity stub; flag-off path
>    unchanged.

## Then (each its own slice, suite-touching — confirm scope first)

- **3c-3**: secrets to Vault (unlocks Reddit / Product Hunt connectors).
- **3c-4**: agent-action audit emission to the unified timeline.
- **3c-5**: HITL approval gate (arrives with the first send/publish/spend
  capability).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
