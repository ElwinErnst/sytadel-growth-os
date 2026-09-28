# Slice 3c-2 — Scope enforcement (Growth-OS side): spec & checklist

## Goal

Governance increment from [ADR 0002](../adr/0002-governance.md): when Sytadel auth
is enabled, operations require the authenticated principal to hold the matching
scope. Per the operator's decisions, this run builds the **Growth-OS-side
capability check only** — the `auth-api` allowlist PR and ServiceAccount
provisioning are deferred.

## Decisions (operator)

- **Scopes:** `research:read`, `research:fetch`, `leads:read`.
- **ServiceAccounts:** one per agent role (research / sales / content).
- **Sequence:** Growth OS first (this slice); the `sytadel-suite` `auth-api` PR +
  provisioning come later.

## Scope

**In:**
- `src/modules/identity/scopes.ts` — the scope vocabulary Growth OS references
  (mirrors auth-api's authoritative allowlist).
- `SytadelIdentityService.requireScope(scope)` — returns the principal (or null
  when auth is disabled), throws `ScopeDeniedError` when enabled and the principal
  lacks the scope; auth failures still surface as `SytadelAuthError`.
- Enforcement at operation entry:
  - `research:read` → `RunOrchestrator.startRun` (analyze).
  - `research:fetch` → `FetchService.fetchToEvidence` (the `fetch` command) and
    `ResearchService.run` (research collection, checked before the per-source
    loop so authz failures are not swallowed by resilience).

**Out (deferred):** the `auth-api` `API_SCOPES` allowlist PR (`sytadel-suite`);
ServiceAccount provisioning; `leads:read` enforcement (reserved for Slice 6);
Vault (3c-3); audit (3c-4); HITL (3c-5).

## Important consequence

The `research:*` scopes do not yet exist in `auth-api`'s closed allowlist (that PR
is pending). So while Sytadel auth is **enabled**, a real ServiceAccount cannot
hold them and research/analyze operations are **gated by design**. With Sytadel
auth **disabled** (the default), nothing changes — the local-identity path keeps
its existing guards (SSRF, workspace isolation, untrusted content).

## Verification checklist

Offline suite (fixture auth server + identity stub; no external network):

- [x] **requireScope** — holds scope → principal; missing → `ScopeDeniedError`;
  disabled → null (`sytadel-identity.spec.ts`).
- [x] **analyze** — principal with `research:read` proceeds; without it →
  `ScopeDeniedError`, no run created (`run-identity.spec.ts`).
- [x] **fetch** — allowed with `research:fetch`; denied without
  (`fetch.spec.ts`).
- [x] **research run** — denied without `research:fetch` (before the source loop)
  (`research.spec.ts`).
- [x] **flag off** — the local-identity path is unchanged (existing suites green,
  123 tests total).

## Next (deferred, suite-touching — confirm before opening)

Open the `sytadel-suite` PR adding `research:read`, `research:fetch`, `leads:read`
to `auth/auth-api/src/modules/integrations/api-scopes.ts` (code-only; allowlist
tests), then provision one ServiceAccount per agent role and enable `apiAuth` on
the tenant. See `docs/next-slice-prompt.md`.
