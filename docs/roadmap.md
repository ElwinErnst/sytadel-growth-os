# Sytadel Growth OS — Internal Customer-Zero Roadmap

**Sytadel's product north star:** build a secure PaaS/control plane for teams
building software and automations with AI agents. Sytadel aims to abstract
identity and tenancy, policy, secrets and Vault, tamper-evident audit/notary,
Billing and entitlements, agent identity, MCP, and human approval controls so
customers can focus on business rules. The current suite is a foundation, not a
complete hosted agent runtime.

**Growth OS's internal north star:** move repetitive go-to-market work toward
AI agents, while the founder remains the sole HITL for consequential decisions
and external actions—including send, publish, and spend.

**Operating principle:** *agents gather evidence and prepare recommendations; the founder alone approves consequential decisions and external actions.*
Every step that touches the outside world (fetch, send, publish, spend) is
**gated** — read/evidence phases first, then human-in-the-loop (HITL) actions,
and finally actions authorized by Sytadel's own policy plane.

**The loop we are building toward:**

```
MARKET -> signals -> agents -> experiments -> customers -> feedback -> data -> new hypothesis
```

## Agents as workflows, not microservices

The "agents" below are **roles / workflow steps inside one modular monolith**,
not separate services. We split a role into its own process only when a real
bottleneck proves it necessary. Slice 1 already demonstrates the pattern:
researcher and brief-writer are two steps of a single workflow.

| Agent (role) | Function |
|---|---|
| Market Research | Competitors, trends, pricing, niches |
| ICP | Refine the ideal customer profile |
| Lead Generation | Find companies and contacts |
| Qualification | Prioritize leads |
| Account Research | Investigate each company |
| Outbound | Prepare emails / LinkedIn (drafts only) |
| Content / SEO | Articles, posts, positioning (drafts only) |
| Competitive Intelligence | Watch Auth0, Clerk, Stytch, WorkOS, Okta, … |
| Customer Discovery | Analyze interviews and feedback |
| CRM / Sales Ops | Pipeline, metrics, conversions |
| Founder Briefing | Summarize findings and pending decisions |

Target org shape:

```
                     Alex
                      | strategy / decisions
                  Growth AI
        +-------------+--------------+
     Research        Sales       Marketing
   Market/CI       Lead/SDR/CRM   Content/SEO/Social
        +-------------+--------------+
                 Analytics Agent
                 Founder Briefing
```

## How to task agents

Never give a generic order ("find customers for Sytadel"). Give **concrete
hypotheses to validate**, e.g.:

- B2B multi-tenant SaaS that don't want to build auth, authorization, secrets,
  and audit from scratch.
- Startups building AI agents that need to control what each agent can do.
- Software houses that need reusable infrastructure.
- Regulated companies that require strong traceability.

Each agent investigates a segment, finds companies, measures responses, and
surfaces where interest concentrates. The founder receives something like:

> 742 companies analyzed · 61 match ICP · 18 show strong signals · 11 contacts
> found · 7 conversations started · 3 demos requested.
> **Key finding:** AI-agent startups show more interest in Agent Identity than
> traditional SaaS. **Proposed experiment:** run an Agent-Security landing for two
> weeks.

## Slices

Legend — External effect: **None** (safe), **Fetch** (read-only outbound,
needs SSRF controls + Governance), **HITL** (human approves the action).

| Track | Slice | Deliverable | External effect |
|---|---|---|---|
| **Core** | **1 ✅** | Manual evidence → signals → Founder Brief (CLI). *Shipped.* | None |
| **Core** | **2 ✅** | Multi-evidence runs; workspace/evidence/run/signal/brief listing (paginated); expanded signal taxonomy; computed calibration summary in the brief. *Shipped.* | None |
| **Research (autonomous)** | **3a ✅** | Web fetch with **SSRF controls** (IP validation + connection pinning), manual redirect re-validation, size/time caps; fetched pages stored as `fetched` evidence. *Shipped.* | Fetch (read-only GET) |
| Research | **3b-1 ✅** | Connector framework + generic `web_page` connector (HTML→text); per-workspace research source registry; resilient `research` run → `fetched` evidence; cron-friendly scheduling. *Shipped.* | Fetch |
| Research | **3b-2 ✅** | Typed connectors on the same contract: `hacker_news` (Algolia API) + `github_releases` (public REST), keyless, JSON→digest. Reddit/Product Hunt deferred (need keys → Vault/3c). *Shipped.* | Fetch |
| Research | **3c ✅** | **Governance** (designed in [ADR 0002](adr/0002-governance.md)) — core complete: **3c-1 identity ✅** · **3c-2 scope enforcement ✅** (Growth-OS side + `auth-api` scopes allowlist merged; SA provisioning pending) · **3c-3 SecretProvider seam ✅** (env-backed) · **3c-4 agent-action audit ✅** (append-only, local) · **3c-5 HITL approval gate ✅** (propose→approve→execute, no autonomous side effects; proven with a simulated delivery) | Fetch → **Governance track (core complete)** |
| Research | 4 ⏳ | **Competitive Intelligence**: watch Auth0/Clerk/Stytch/WorkOS/Okta; diff over time → signals. _Not started — deprioritized after 3b in favor of the governance track; still pending._ | Fetch |
| **ICP & Opportunity** | **5 ✅** | **ICP Agent**: versioned ICP synthesized from a workspace's signals (segments/pains grounded in signal ids), via `icp:generate`/`icp:show`; scope-gated + audited. *Shipped.* | None |
| ICP | **6 (core) ✅** | **Account Research**: register candidate companies (operator notes) + ICP-fit scoring (grounded in ICP segments, tier from score). *Shipped.* Automated lead discovery/enrichment (Fetch) + contacts = 6b, pending. | None (6b: Fetch) |
| ICP | 7 | **Qualification / scoring** vs ICP → the funnel report ("N analyzed / M ICP / K strong…") | None |
| **Discovery** | 8 | **Customer Discovery**: structured interview capture + pattern analysis (see schema below) | None |
| **Marketing** | 9 | **Content / SEO**: one question → drafts for article/LinkedIn/X/HN/newsletter/landing. Human publishes | HITL to publish |
| **Sales / CRM** | 10 | **CRM / Sales Ops**: pipeline, metrics, conversions (own data) | None |
| Sales | 11 | **Outbound**: personalized emails/LinkedIn from account signals. **Drafts only, behind HITL; no auto-send** | HITL (strict) |
| **Aggregation** | 12 | **Analytics Agent + periodic Founder Briefing** across all tracks | None |

### Autonomous research chain (Slices 3–7)

```
Market -> Signals Agent -> Research Agent -> Opportunity Agent -> Product Agent -> Experiment -> Results -> Founder
```

### Customer Discovery capture schema (Slice 8)

Each conversation records: `problem, company, role, current_solution, pain,
budget, urgency, competitor_mentioned, feature_requested, objection`. Agents then
mine dozens of conversations for patterns that can shift positioning.

### Content themes (Slice 9)

Technical content is likely Sytadel's best channel: *How to authenticate AI
agents · Why API keys are dangerous for autonomous agents · Zero Trust
architecture for AI agents · Multi-tenant authorization architecture ·
Human-in-the-loop authorization · Agent identity vs service accounts.* A single
real question can fan out to article + LinkedIn + X + Reddit/HN + newsletter +
landing (all drafts).

## Track G — Governance / Customer-zero dogfooding (parallel, enters at Slice 3)

The strategic differentiator: the agents running Sytadel's growth are themselves
**governed by Sytadel's own control plane**. As soon as an agent acts on the
world, the local operator identity is no longer sufficient:

- **Identity:** each agent = a `ServiceAccount` in `auth-api`, authenticated via
  `zerotrust-api`.
- **Scopes (new, least-privilege):** propose additions to `auth-api`'s closed
  allowlist — `research:read`, `research:fetch`, `leads:read`, `content:draft`,
  `content:publish`, `outreach:draft`, `outreach:send`. (None exist today — see
  `docs/integration/sytadel-capabilities.md`.)
- **Policy:** per-agent limits in `zerotrust-api`. A Sales agent may read CRM,
  research, and draft — but never change pricing, sign contracts, or approve
  discounts. A Finance agent may report — but never move money.
- **Secrets:** connector/provider keys in Vault, out of git/prompts/logs.
- **Audit:** agent actions emitted to the suite's unified audit timeline.
- **HITL:** every sensitive action (send/publish/spend) requires human approval.

**Customer-zero outcome:** use Growth OS internally to validate how Sytadel's
control-plane capabilities should support teams building with AI agents. The
product direction includes Identity + Secrets/Vault + Policy + Audit/Notary +
HITL + Billing/entitlements + Agent Identity + MCP. Growth OS is Sytadel Labs'
internal GTM engine, not a customer-facing product; the hosted runtime and the
complete integrated platform remain target capabilities until implemented and
verified. The founder is the sole HITL for consequential decisions and external
actions.

## Guardrails carried across every slice

- Deterministic flows around model calls; schema-validated output; visible
  failures (never fabricated results).
- Idempotency/dedup by DB constraints; persisted state; recoverable runs;
  timeouts, bounded retries, token/call budgets.
- Source content is untrusted data; instructions inside it never enable actions.
- Workspace isolation; secrets only in the environment/Vault.
- No external side effects without the gate for that effect (Fetch → Governance;
  send/publish/spend → HITL).

## Status

- **Slices 1 → 3c-5 and 5 (ICP): shipped** (this repo). **The Governance track
  (3c) is core complete**: identity, scope enforcement, secret seam, audit, and
  the HITL gate all landed. The `auth-api` allowlist PR is **merged** (auth-api
  #19). Remaining governance work is operator/suite (not new Growth OS features):
  provision one SA per agent role + tenant `apiAuth`; bump the `auth-api`
  submodule pointer in `sytadel-suite`; forward the audit trail to the unified
  timeline. On the product side, the next track is **Lead Generation + Account
  Research (Slice 6)**. See `docs/next-slice-prompt.md`.
