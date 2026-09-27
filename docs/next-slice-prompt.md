# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, taxonomy, calibration), Slice 3a (hardened web fetch, SSRF),
> Slice 3b-1 (connector framework + `web_page`, research registry, resilient
> `research` run, cron), Slice 3b-2 (typed connectors: `hacker_news`,
> `github_releases`). See `docs/mvp/`.

## Slice 3c — Governance: DESIGNED (see ADR 0002)

The full governance architecture is fixed in
[`docs/adr/0002-governance.md`](adr/0002-governance.md), grounded in the verified
`auth-api` service-account token contract. It is split into ordered increments
(3c-1 … 3c-5). No `sytadel-suite` PR is opened without confirming scope first.

## Recommended next: Slice 3c-1 — Sytadel identity client (no suite changes)

> Implement the identity increment from ADR 0002, entirely inside Growth OS:
>
> 1. `SytadelIdentityService` that authenticates a ServiceAccount against the
>    EXISTING `POST /api/integrations/service-account-token` endpoint and returns
>    the authenticated principal (tenant, serviceAccountId, scopes) from the JWT
>    claims. Growth OS is a CLIENT (presents credentials); it does not verify
>    others' tokens.
> 2. Add nullable `AgentRun.sytadel_subject` + `sytadel_tenant_id` (additive
>    migration); record them on runs when auth is enabled. NEVER conflate with
>    `executor_id`.
> 3. Feature flag `GROWTH_SYTADEL_AUTH` (default off → today's local identity).
>    Config for auth-api base URL + ServiceAccount credentials (from env now,
>    Vault in 3c-3). Token cached in memory only, re-issued on expiry, never
>    persisted/logged.
> 4. Tests against a FIXTURE auth server (local HTTP), no real network in CI:
>    successful auth records the principal; auth failure is visible and does not
>    fall back to local silently; flag-off path unchanged.
>
> This needs NO new scopes and NO suite changes. Provisioning a real tenant/
> ClientApp/ServiceAccount + enabling the `apiAuth` entitlement is an operator
> step, documented — not required for offline verification.

## Then (each its own slice, suite-touching — confirm scope first)

- **3c-2**: add `research:read` / `research:fetch` to `auth-api`'s allowlist
  (`src/modules/integrations/api-scopes.ts`) via a separate `sytadel-suite` PR.
- **3c-3**: secrets to Vault (unlocks Reddit / Product Hunt connectors).
- **3c-4**: agent-action audit emission to the unified timeline.
- **3c-5**: HITL approval gate (arrives with the first send/publish/spend
  capability).

## Then: Slice 3c — Governance (touches `auth-api`)

This is the "en Slice 3 lo vemos" decision. It is the first change that touches
`sytadel-suite`.

- Propose new least-privilege scopes in `auth-api`
  (`src/modules/integrations/api-scopes.ts`) — e.g. `research:read`,
  `research:fetch` — as a **separate PR to `sytadel-suite`** (the allowlist is
  closed; unknown scopes are rejected at key creation).
- Make each agent role an `auth-api` `ServiceAccount`; route calls through
  `zerotrust-api`; move connector/provider secrets to Vault; emit agent-action
  audit to the suite's unified timeline; add HITL for any sensitive action.
- Only after this does the local executor identity get replaced by a
  Sytadel-authenticated principal (add a `sytadel_subject` field; never conflate
  it with `executor_id`).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
