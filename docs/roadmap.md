# Sytadel Growth OS — Roadmap

**North star:** move 80–90% of repetitive go-to-market work (research, leads,
marketing, CRM, customer discovery) to AI agents, leaving the founder with
product vision, key relationships, strategy, and capital allocation.

**Operating principle:** *agents present evidence; the human decides strategy.*
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
| Research | 3c | **Governance** (designed in [ADR 0002](adr/0002-governance.md)): **3c-1 identity ✅** · **3c-2 scope enforcement ✅** (Growth-OS side + `auth-api` scopes allowlist merged; SA provisioning pending) · **3c-3 SecretProvider seam ✅** (env-backed) · **3c-4 agent-action audit ✅** (append-only run-lifecycle trail, local to Growth OS; suite-timeline forward later) · 3c-5 HITL | Fetch → **Governance track** |
| Research | 4 | **Competitive Intelligence**: watch Auth0/Clerk/Stytch/WorkOS/Okta; diff over time → signals | Fetch |
| **ICP & Opportunity** | 5 | **ICP Agent**: refine ideal customer from signals + the concrete hypotheses above | None |
| ICP | 6 | **Lead Generation + Account Research**: companies & contacts, each evidence-backed | Fetch |
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

## Track G — Governance / Dogfooding (parallel, enters at Slice 3)

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

**Endgame:** *"Sytadel is a company operated by AI agents secured by Sytadel."*
This is simultaneously the reference implementation of a **Sytadel Agent Control
Plane** (Identity + Secrets + Policy + Audit + HITL + Billing) — a product for
companies deploying AI workers.

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

- **Slices 1, 2, 3a, 3b-1, 3b-2, 3c-1, 3c-2, 3c-3, 3c-4: shipped** (this repo).
  The `auth-api` allowlist PR is **merged** (auth-api #19); operator provisioning
  (one SA per agent role + tenant `apiAuth`) remains. Next build: **3c-5 HITL**
  (arrives with the first send/publish/spend capability); plus two later
  suite-touching steps — forward the audit trail to the unified timeline, and
  bump the `auth-api` submodule pointer in `sytadel-suite`. See
  `docs/next-slice-prompt.md`.
