# Slice 3c-1 — Sytadel identity client (opt-in): spec & checklist

## Goal

First governance increment from [ADR 0002](../adr/0002-governance.md), entirely
inside Growth OS: runs can authenticate as an `auth-api` ServiceAccount and be
attributed to that Sytadel principal — with **no `sytadel-suite` changes and no
new scopes**.

## Scope

**In:**
- `SytadelIdentityService` — authenticates against the EXISTING
  `POST /api/integrations/service-account-token` endpoint and returns the
  principal (tenant, serviceAccountId, scopes) from the response. Growth OS is a
  client; it does not verify others' tokens. Token cached in memory, re-issued on
  expiry; secret/token never persisted or logged.
- Config block `GROWTH_SYTADEL_*` with a feature flag (`GROWTH_SYTADEL_AUTH`,
  default off) and validation that requires all fields when enabled.
- Additive nullable `AgentRun.sytadel_subject` + `sytadel_tenant_id` (migration);
  recorded on run creation when auth is enabled. Never conflated with
  `executor_id`.
- `RunOrchestrator` resolves the principal at run start: disabled → null (local
  identity); enabled + success → attributed; enabled + failure → visible error,
  **no run created, no silent fallback**.
- CLI run summary shows the identity (`sytadel sa=… tenant=…` or `local
  executor=…`).

**Out:** scope authorization (`research:*` — 3c-2, suite PR); Vault secrets
(3c-3); audit emission (3c-4); HITL (3c-5). No HTTP endpoints; no send/publish/
spend.

## Design notes

- The token response already carries `tenant` and `serviceAccount.scopes`, so the
  principal is read directly — no JWT decoding needed.
- Feature-flag default off keeps every existing run on local identity; enabling is
  an explicit operator choice.
- Real runtime use needs a tenant with the `apiAuth` entitlement plus a ClientApp
  + ServiceAccount provisioned in `auth-api`; that is an operator step, documented
  and NOT required for offline verification.

## Verification checklist

Offline suite (fixture auth server + harness override; no external network):

- [x] **Disabled → null, no request** (`sytadel-identity.spec.ts`).
- [x] **Enabled + valid → principal** parsed from the token response; correct
  credential body sent (`sytadel-identity.spec.ts`).
- [x] **Token caching** — repeat calls hit the endpoint once
  (`sytadel-identity.spec.ts`).
- [x] **Rejected credential (401) → `SytadelAuthError`**, no null fallback
  (`sytadel-identity.spec.ts`).
- [x] **Unexpected shape / not fully configured → `SytadelAuthError`**
  (`sytadel-identity.spec.ts`).
- [x] **Flag off (default) → run keeps local identity**, `sytadel_subject` null
  (`run-identity.spec.ts`).
- [x] **Authenticated → run attributed** to the principal, local `executor_id`
  preserved (`run-identity.spec.ts`).
- [x] **Auth failure → startRun throws, no run persisted** (`run-identity.spec.ts`).
- [x] **Manual smoke** — flag off: an `analyze` run reports `identity: local
  executor=local-cli`.

## Try it (real, requires provisioning)

```bash
# In .env: enable + fill credentials (tenant must have the apiAuth entitlement)
GROWTH_SYTADEL_AUTH=true
GROWTH_SYTADEL_AUTH_URL=http://localhost:3001/api
GROWTH_SYTADEL_TENANT_SLUG=...
GROWTH_SYTADEL_CLIENT_APP_ID=...
GROWTH_SYTADEL_SERVICE_ACCOUNT_ID=...
GROWTH_SYTADEL_CLIENT_SECRET=...

npm run growth -- analyze --workspace sytadel --file <ev.md> \
  --source-url https://example.com --source-name S --retrieved-at 2026-09-28T00:00:00Z
# run summary shows: identity: sytadel sa=<id> tenant=<id>
```
