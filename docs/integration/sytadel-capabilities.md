# Sytadel integration — verified capabilities & boundaries

This document records what actually exists in `sytadel-suite` today (verified by
inspection on 2026-09-20), what Growth OS can reuse, and what needs to be built
before deeper integration. It is the contract for how Growth OS talks to Sytadel.

> Rule: integrate **only** through verified public APIs. Never import Sytadel
> internal code or query its databases directly.

## Suite shape (verified)

`sytadel-suite` is a meta-repository of **independent services**:

| Service | Role (verified) |
|---|---|
| `auth-api` | Identity authority: users, tenants, memberships, sessions, JWT issuance; client apps + service accounts + **scoped API keys**; internal directory for other services. |
| `zerotrust-api` | Policy gateway: validates JWTs, resolves per-tenant policy, signs upstream calls. |
| `securechain-vault` | Document custody / tamper-evident audit chain. |
| `billing-api` | Billing, entitlements, webhooks. |
| `mcp-server` | MCP surface exposing 5 identity/access tools; tenant is always derived from the authenticated principal, never a model argument. |

## What Growth OS can reuse (later, via API)

- **Service-account authentication** in `auth-api`: a `ClientApp` owns
  `ServiceAccount`s, each with a hashed secret and an **environment**; keys
  authenticate and carry scopes enforced by the resource server.
- **Per-tenant policy** via `zerotrust-api`: calls routed through the gateway are
  authorized per tenant/principal — the natural place to constrain what a given
  agent may do.
- **Tamper-evident audit** patterns in `securechain-vault` and the suite's
  unified audit timeline — the target for emitting agent-action audit later.

## What does NOT exist yet (must be built before use)

These were checked and are **absent** today. Do not assume them:

- **A shared SDK.** Each service is standalone; there is no common client library.
- **Research or messaging scopes.** `auth-api`'s scope allowlist
  (`src/modules/integrations/api-scopes.ts`) is a **closed** list containing only:
  `payments:create/read`, `subscriptions:create/read`, `refunds:create`,
  `usage:write/read`, `webhooks:manage`, `billing:read`. There is no
  `research:*`, `leads:*`, `outreach:*`, or `content:*`. Adding any requires a PR
  to that allowlist (unknown scopes are rejected at key creation, by design).
- **A generic secrets manager**, **generic agent runtime**, **generic
  business-action approval (HITL) system**, or a **universal audit-ingestion
  endpoint**.

## Consequence for Growth OS

Because governed agent identity and agent scopes do not exist yet, Slice 1 uses a
**local operator identity** (`executor_kind = local`) that is explicitly distinct
from a Sytadel-authenticated principal. Growth OS is a self-contained system that
happens to research the Sytadel market; it does not yet call Sytadel at runtime.

## Governance integration plan (future — enters at roadmap Slice 3)

When Growth OS first performs an action with an external effect (web fetch, then
outbound), the local identity is no longer sufficient and the **Governance track**
begins. Planned, in order:

1. **Identity:** each agent role becomes a `ServiceAccount` in `auth-api`,
   authenticating through `zerotrust-api`.
2. **Scopes (new, least-privilege):** propose additions to `auth-api`'s allowlist,
   e.g. `research:read`, `research:fetch`, `leads:read`, `content:draft`,
   `content:publish`, `outreach:draft`, `outreach:send`. Each agent holds only
   what it needs.
3. **Policy:** encode per-agent limits in `zerotrust-api` (e.g. a Sales agent may
   read CRM, research, and draft, but never change pricing, sign contracts, or
   approve discounts; a Finance agent may report but never move money).
4. **Secrets:** connector/provider keys move to Vault — out of git, prompts, logs.
5. **Audit:** agent actions emit to the suite's unified audit timeline.
6. **HITL:** every sensitive action (send/publish/spend) requires human approval.

Endgame: agents operating Sytadel's own growth, governed by Sytadel —
"Sytadel is a company operated by AI agents secured by Sytadel" — which doubles as
the reference implementation of a **Sytadel Agent Control Plane**
(Identity + Secrets + Policy + Audit + HITL + Billing) for customers deploying AI
workers.

## Web-fetch phase — controls (IMPLEMENTED in Slice 3a)

The fetch capability shipped in Slice 3a (`src/modules/fetch/`) with:

- Protocol allowlist (`http`/`https`) and **SSRF protection**: private,
  loopback (`127.0.0.0/8`, `::1`), link-local/metadata (`169.254.0.0/16` incl.
  `169.254.169.254`, `fe80::/10`), unique-local (`fc00::/7`), CGNAT
  (`100.64.0.0/10`), multicast, unspecified, reserved — including IPv4-mapped v6.
- **Redirect re-validation** on every hop, with a redirect cap.
- **DNS-rebinding mitigation**: a custom DNS lookup validates the address and the
  connection is pinned to that exact IP.
- Response size/time caps; content stored as untrusted `fetched` evidence.

Still local identity — the fetch runs under the local operator, not a Sytadel
principal. Governing it (Slice 3c) is the next integration step below.
