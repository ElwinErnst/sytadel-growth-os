# ADR 0002 — Governance: agents governed by Sytadel's own control plane

- **Status:** Proposed (design only; no code, no `sytadel-suite` changes)
- **Date:** 2026-09-27
- **Context tags:** architecture, security, integration, identity
- **Supersedes/extends:** [ADR 0001](0001-private-separation-and-sytadel-boundaries.md)

## Context

Through Slice 3 (3a fetch, 3b connectors), Growth OS now acts on the world:
it makes outbound HTTP requests to collect research. So far every run is
attributed to a **local operator identity** (`AgentRun.executor_kind = local`),
deliberately distinct from any Sytadel principal (ADR 0001, §4).

The product goal is that the agents running Sytadel's growth are **governed by
Sytadel's own control plane** — *"Sytadel is a company operated by AI agents
secured by Sytadel."* This is also the reference implementation of a future
**Sytadel Agent Control Plane** (Identity + Secrets + Policy + Audit + HITL +
Billing) for customers deploying AI workers.

This ADR fixes the target architecture and the increment order. It builds nothing
and changes nothing in `sytadel-suite`.

### Verified current state of `auth-api` (2026-09-27)

- **Service-account authentication exists today:**
  `POST /api/integrations/service-account-token` with
  `{ tenantId | tenantSlug, clientAppId, serviceAccountId, clientSecret }`
  returns a signed JWT whose claims include `actorType: "service_account"`,
  `tenantId`, `serviceAccountId`, `clientAppId`, `environmentId`, and `scopes`.
- Token issuance requires the tenant to hold the **`apiAuth` entitlement**
  ("Auth API Pack"); it also meters a `service_account_tokens_issued` usage event.
- Scopes are drawn from a **closed allowlist** (`src/modules/integrations/api-scopes.ts`)
  that is **billing-only today** — `payments:*`, `subscriptions:*`, `refunds:*`,
  `usage:*`, `webhooks:manage`, `billing:read`. **No `research:*` / `outreach:*` /
  `content:*` scopes exist**, and unknown scopes are rejected at key creation.
- `zerotrust-api` is the policy gateway (validates JWTs, resolves per-tenant
  policy, signs upstream calls). `securechain-vault` holds tamper-evident audit.

**Consequence:** *Identity* (authenticating as a Sytadel principal and attributing
runs to it) is achievable **with the existing endpoint and no new scopes**.
*Authorization by `research:*` scopes*, policy routing, secret custody, audit
emission, and HITL each require additional work — some of it inside
`sytadel-suite`.

## Decision

Adopt the following target architecture, delivered as ordered increments. Each
increment is its own slice with its own review/PR; only 3c-2+ touch the suite.

### Identity model

- Growth OS authenticates as an `auth-api` **ServiceAccount** (one per agent role
  as roles are introduced) via the existing token endpoint, and treats the
  returned JWT's claims as the authenticated principal.
- `AgentRun` gains a **nullable `sytadel_subject`** (the `serviceAccountId`) plus
  `sytadel_tenant_id`. These are **additive and never conflated with
  `executor_id`** (ADR 0001, §4). When Sytadel auth is enabled, a run records
  both the local executor and the Sytadel principal.
- Behind a feature flag (`GROWTH_SYTADEL_AUTH`, default **off**). Off = today's
  local identity; on = authenticate and attribute. Growth OS is a **client** of
  the plane, not a resource server: it presents credentials and records the
  principal; it does not verify others' tokens.
- Token handling: cache the short-lived access token in memory only; never
  persist it; re-issue on expiry. The client secret comes from the environment
  (later Vault, 3c-3), never from git/prompts/logs.

### Scope model (least privilege)

- Propose new scopes on the `auth-api` allowlist, **in a separate `sytadel-suite`
  PR**: start with `research:read`, `research:fetch`. Later, as capabilities
  land: `leads:read`, `content:draft`, `content:publish`, `outreach:draft`,
  `outreach:send`.
- Each agent role's ServiceAccount holds **only** the scopes it needs. Example
  target policy: a future Sales agent may `read CRM / research / draft` but never
  `change pricing / sign / approve discounts`; a Finance agent may `report` but
  never `move money`.
- Growth OS enforces its own capability checks locally too; scopes are the
  authority's enforcement, not a substitute for internal guards.

### Policy routing (zerotrust)

- Calls that must be authorized (initially none at runtime beyond identity; later
  outbound/publish/spend) route **through `zerotrust-api`**, so per-tenant policy
  decides what a principal may do. Read-only research keeps working under identity
  alone until an action needs authorization.

### Secrets (Vault)

- Connector/provider secrets (LLM key, ServiceAccount secret, and API keys for
  key-based connectors like **Reddit / Product Hunt**) move to **Vault**. This is
  what unlocks the deferred key-based connectors. Secrets never touch git,
  prompts, or logs.

### Audit

- Emit **agent-action audit events** (run started/completed/failed, fetch
  performed, brief generated, and later any HITL-gated action) to the suite's
  unified audit timeline, reusing existing audit patterns. Audit is append-only
  and carries the Sytadel principal + tenant.

### Human-in-the-loop (HITL)

- Any action with an external side effect — **send / publish / spend** — is
  blocked on explicit human approval. Growth OS models an approval as a persisted
  gate: a proposed action is stored, surfaced to the operator, and only executed
  after approval; denials and expiries are recorded. No autonomous send/publish/
  spend, ever, regardless of scopes.

## Invariants carried forward

- Local identity and Sytadel identity are **never conflated**; `sytadel_subject`
  is additive and nullable.
- Source content stays **untrusted data**; SSRF controls (ADR/Slice 3a) always
  apply to every fetch, including connector fetches.
- Failures are visible and sanitized; never fabricated results.
- Nothing sends/publishes/spends without HITL — this outranks any scope grant.

## Increment order

| Increment | Scope | Touches suite? |
|---|---|---|
| **3c-1** | Identity client: authenticate ServiceAccount, record `sytadel_subject`/tenant on runs, feature-flagged, fixture-tested | No |
| **3c-2** | Add `research:read` / `research:fetch` to `auth-api` allowlist | **Yes** (separate `sytadel-suite` PR) |
| **3c-3** | Secrets to Vault; unlock key-based connectors (Reddit / Product Hunt) | **Yes** |
| **3c-4** | Agent-action audit emission to the unified timeline | **Yes** |
| **3c-5** | HITL approval gate for send/publish/spend (arrives with the first such capability) | Maybe |

Each increment is scoped and reviewed on its own. **No `sytadel-suite` PR is
opened without confirming scope with the operator first** (per ADR 0001 and the
Slice 3 agreement).

## Consequences

- **Positive:** a clear, incremental path to governed agents; 3c-1 delivers real
  value (runs attributable to a Sytadel principal) with zero suite risk;
  least-privilege and HITL are designed in from the start; dogfoods the Agent
  Control Plane story.
- **Cost:** several increments touch `sytadel-suite` and need coordinated PRs;
  the `apiAuth` entitlement must be enabled for the tenant Growth OS runs under;
  token/secret handling adds operational setup.
- **Risk:** scope creep in the allowlist (mitigate: least-privilege, one scope
  pair at a time); over-trusting the JWT (mitigate: Growth OS is a client, keeps
  its own guards); secret leakage (mitigate: Vault + never-log rule).

## Alternatives considered

- **Growth OS as a resource server** verifying inbound Sytadel tokens — rejected
  for this stage: Growth OS has no inbound data endpoints (CLI-first), so there
  is nothing to protect that way yet.
- **Skip identity, gate only at action time** — rejected: attribution/audit want
  the principal on every run, and identity is cheap and suite-free (3c-1).
- **One big governance slice** — rejected: too large to review safely and mixes
  suite-touching and local work.

## Open questions (confirm with operator)

1. Which tenant + ClientApp does Growth OS run under, and is `apiAuth` enabled?
2. One ServiceAccount for Growth OS now, or one per agent role from the start?
3. Is the `research:*` scope pair the right initial vocabulary, or add
   `leads:read` immediately?
4. Vault deployment: reuse the suite's `securechain-vault`, or a Growth-OS-scoped
   secrets path?
