# ADR 0001 — Private separation and Sytadel boundaries

- **Status:** Accepted
- **Date:** 2026-09-20
- **Context tags:** architecture, security, integration

## Context

Sytadel needs a system to run market research and growth work (research, ICP,
leads, content, discovery, CRM, founder briefings), increasingly with AI agents.
The long-term vision is that these agents are themselves governed by Sytadel's
own control plane ("Sytadel is a company operated by AI agents secured by
Sytadel"). See `docs/roadmap.md`.

A discovery pass over `sytadel-suite` established the current, factual state:

- It is a **meta-repository of independent services** (`auth-api`,
  `zerotrust-api`, `securechain-vault`, `billing-api`, `mcp-server`).
- `auth-api` is the identity authority (client apps, service accounts, scoped
  API keys). Its scope allowlist is **closed** and contains only
  billing/payments-oriented scopes. There are **no research or messaging
  scopes**.
- There is **no** shared SDK, no generic secrets manager, no generic agent
  runtime, no generic business-action approval system, and no universal audit
  ingestion endpoint.

We must decide how Growth OS relates to Sytadel and where its boundaries are for
the first functional slice.

## Decision

1. **Growth OS is a separate, private repository.** It is not a Sytadel
   submodule and not part of the Sytadel Compose stack. This slice makes **no
   changes** to `sytadel-suite` or its submodules.

2. **Integration with Sytadel happens only through verified public APIs.** No
   importing Sytadel internal modules/entities/repositories; no direct database
   access to auth/vault/billing.

3. **Growth OS owns its own data** — runs, evidence, signals, briefs — in its own
   PostgreSQL database. **Sytadel remains the identity authority.**

4. **Executor identity is local in this slice.** Because no research/agent scopes
   exist in `auth-api` and no agent-governance surface exists yet, runs record a
   **local operator identity** (`executor_kind = local`), deliberately kept
   distinct from a Sytadel-authenticated principal. When Sytadel identity
   integration lands, it will be added as a separate, clearly-named attribute
   (e.g. `sytadel_subject`) — the two identities must never be conflated.

5. **CLI-first, no data endpoints.** The slice ships a CLI over a headless Nest
   application context. No HTTP data endpoints are exposed before full
   authentication exists.

6. **No external side effects.** No fetching, sending, publishing, or spending.
   Web fetching specifically is deferred to a later slice with SSRF controls.

## Consequences

- **Positive:** Clear blast radius; no coupling to Sytadel internals; Growth OS
  can iterate fast; security posture is conservative (nothing acts on the world).
- **Positive:** The local-vs-Sytadel identity split is explicit in the schema, so
  the future governance slice is additive, not a refactor.
- **Cost:** Some capabilities (governed agent identity, audit emission, HITL) are
  not available yet and are tracked as future work; enabling them requires
  evolving `auth-api` (new scopes) and building integration adapters.
- **Revisit when:** the roadmap reaches Slice 3 (first external effect / web
  fetch), which triggers the Governance track — see
  `docs/integration/sytadel-capabilities.md` and `docs/roadmap.md`.
