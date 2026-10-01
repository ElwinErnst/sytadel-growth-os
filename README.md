# Sytadel Growth OS

**A private, evidence-driven market-research and growth workbench for Sytadel.**
It turns operator-supplied material into structured, traceable market signals and
an evidence-backed **Founder Brief** — so strategy decisions rest on facts and
clearly-labeled hypotheses, not vibes.

The guiding principle across everything here: **agents present evidence; the human
decides strategy.** Every claim in a brief traces back to a piece of evidence you
supplied, and facts, hypotheses, recommendations, and uncertainty are always kept
separate.

> **Status:** CLI-first foundation, actively built in small slices. Working today:
> the core `evidence → signals → Founder Brief` workflow, multi-evidence runs,
> hardened web fetch, a research-source registry with connectors, opt-in Sytadel
> identity with scope enforcement, a `SecretProvider` seam, an append-only
> agent-action audit trail, and a human-in-the-loop approval gate. **Not yet:**
> HTTP data endpoints, outbound messaging, or any autonomous side effect. Full
> plan in [`docs/roadmap.md`](docs/roadmap.md).

---

## Why this exists

Sytadel's go-to-market work — researching competitors, finding segments, building
an ICP, analyzing feedback — is repetitive and evidence-heavy. Growth OS is the
foundation for moving that work to AI agents **without** losing rigor or control:
the agents gather and structure evidence; the founder makes the calls.

Longer term this grows into a multi-agent "Growth AI" (research → signals →
experiments → customers → feedback → new hypotheses), where each agent is
**governed by Sytadel's own control plane** (identity, policy, secrets, audit,
human-in-the-loop) — dogfooding Sytadel as *"a company operated by AI agents
secured by Sytadel."* See the [roadmap](docs/roadmap.md) and
[ADR 0002](docs/adr/0002-governance.md).

This slice deliberately stays small, deterministic, and safe so that the
larger, more autonomous system is built on solid ground.

## Relationship to Sytadel

Growth OS is a **separate, private repository** — **not** a `sytadel-suite`
submodule and **not** part of the Sytadel Compose stack. It has its own database
and lifecycle. It integrates with Sytadel **only through verified public APIs**;
it never imports Sytadel internals or reads the auth/vault/billing databases
directly. See [`docs/integration/sytadel-capabilities.md`](docs/integration/sytadel-capabilities.md)
for the verified integration surface, and [ADR 0001](docs/adr/0001-private-separation-and-sytadel-boundaries.md)
for the boundary decision.

By default a run is attributed to a **local operator identity**. Authenticating as
a Sytadel principal is opt-in (see [Identity](#identity)); Sytadel remains the
identity authority.

## Mental model

```
manual or fetched evidence  →  structured signals  →  Founder Brief
      (untrusted data)          (each cites evidence)   (facts vs hypotheses)
```

- **Workspace** — the isolation boundary. Everything (evidence, runs, signals,
  briefs, sources) belongs to exactly one workspace; cross-workspace references
  are rejected.
- **Evidence** — a piece of source material, either supplied by you or fetched by
  Growth OS. Its content is always treated as **untrusted data**.
- **Run** — one execution of the market-research workflow over a set of evidence.
  It has a persisted state machine, so it is idempotent and resumable.
- **Signal** — a structured claim the model extracted, tagged as a **fact** (stated
  by the evidence) or a **hypothesis** (inferred), and **required to cite** a piece
  of evidence actually supplied to the run. Invented citations are rejected.
- **Founder Brief** — built only from persisted signals. It separates findings
  (with their evidence trail), implications for Sytadel, hypotheses to validate, a
  suggested next experiment, and explicit uncertainty/coverage limits — plus a
  computed calibration summary (fact/hypothesis counts, average confidence).

## What it does today

- **Ingest evidence** manually (file + declared source URL + retrieval date) or by
  **fetching a URL** under strict SSRF controls. Content is stored verbatim and
  deduplicated per workspace by hash.
- **Research sources** — register sources per workspace and collect them in one
  resilient `research` run via connectors: `web_page` (HTML→text), `hacker_news`
  (Algolia API), `github_releases` (public REST). All keyless, all through the
  hardened fetcher.
- **Analyze** evidence into market/competition signals (schema-validated, each
  citing its evidence), then **generate a Founder Brief** from those signals.
- **Inspect & export** — list workspaces/evidence/runs/signals/briefs; show or
  export a brief as Markdown.
- **Opt-in Sytadel identity** — attribute runs to an authenticated `auth-api`
  ServiceAccount principal, alongside the local identity.

Everything is driven from the **CLI** (a headless NestJS application context).
There are intentionally **no HTTP data endpoints** yet — no data surface is
exposed before full authentication and authorization exist.

## Data model

| Entity | Purpose |
|---|---|
| `Workspace` | Isolation boundary (unique slug). |
| `SourceEvidence` | Operator-supplied (`manual`) or `fetched` content; dedup per workspace by content hash. |
| `ResearchSource` | A configured source (`web_page` / `hacker_news` / `github_releases`) collected by `research`. |
| `AgentRun` | One workflow execution: state, stage, versions, token usage, local + (optional) Sytadel identity. |
| `RunEvidence` | The evidence set supplied to a run (what its signals may cite), in operator order. |
| `MarketSignal` | A fact/hypothesis claim citing one evidence item; deduped per run by fingerprint. |
| `FounderBrief` | One per run; structured content + rendered Markdown, grounded only in persisted signals. |

## Architecture & principles

- **Modular monolith** — NestJS 10 + TypeScript + PostgreSQL (TypeORM with
  **explicit migrations**; `synchronize` is off everywhere). The "agents"
  (researcher, brief-writer, connectors) are **workflow steps/roles**, not
  microservices.
- **Deterministic around the model.** Prompts are versioned; the model call is the
  only non-deterministic hop; its output is parsed and **schema-validated** (zod).
  The LLM sits behind a small provider interface (real Anthropic provider +
  deterministic fixture provider for tests/offline).
- **Failures are visible, never fabricated.** Provider/validation failures fail the
  run with a **sanitized** error (no secrets, source content, or raw payloads) —
  they are never silently replaced with made-up results.
- **Idempotent & recoverable.** Runs persist their stage; re-running with the same
  idempotency key resumes from the last durable stage, a new key reprocesses.
  Dedup/idempotency are enforced by **DB constraints**, not read-then-write checks,
  so they are concurrency-safe.
- **Bounded.** Per-call timeouts, capped retries, and a per-run token budget.

## Security model

- **Source content is untrusted data.** Instructions embedded in evidence can
  never trigger tools or actions — there are none to trigger, and prompts fence
  evidence as data.
- **Hardened fetch (SSRF).** The fetcher only allows `http`/`https`, validates
  every destination IP at connect time and **pins the connection to the validated
  IP** (closing the DNS-rebinding window). Private, loopback, link-local,
  unique-local, CGNAT, multicast, unspecified, and cloud-metadata
  (`169.254.169.254`) ranges — including IPv4-mapped IPv6 — are always blocked.
  Redirects are followed manually and **re-validated each hop**; response size and
  total time are bounded.
- **Workspace isolation.** Every row is workspace-scoped; a run's signals may only
  cite evidence supplied to that run in the same workspace.
- **Secrets stay out of git/prompts/logs — and out of the config object.** All
  secret access goes through a single `SecretProvider` seam
  (`src/modules/secrets`); the env-backed implementation is the current backend
  (the suite has no secrets manager, and `securechain-vault` is document custody,
  not a KV store). Secrets are never placed on the validated config object, and
  access tokens are cached in memory only. Swapping in a real secrets backend is
  a one-file change with no consumer impact.
- **No autonomous side effects.** Nothing is sent, published, or spent. Any action
  with an external effect is gated behind a **human-in-the-loop approval** that
  outranks any scope grant (see [HITL](#human-in-the-loop-hitl)).

## Prerequisites

- Node.js ≥ 20
- Docker (for local PostgreSQL)
- An Anthropic API key **only** for real analysis. Offline runs and the entire
  test suite use a deterministic fixture provider and need no key.

## Quickstart

```bash
npm ci                                   # install
cp .env.example .env                     # configure (edit for a real provider/key)
docker compose up -d growth-postgres     # local Postgres, isolated, on :5440
npm run migration:run                    # create the schema

# Run an analysis OFFLINE (no API key — deterministic fixture provider)
GROWTH_LLM_PROVIDER=fixture npm run growth -- analyze \
  --workspace sytadel \
  --file test/fixtures/sample-evidence.md \
  --source-url https://example.com/pricing \
  --source-name "Competitor snapshot" \
  --retrieved-at 2026-09-20T00:00:00Z
# → prints a run id

npm run growth -- brief:show   --run <run-id>
npm run growth -- brief:export --run <run-id> --out exports/brief.md
```

For a **real** analysis, set `GROWTH_LLM_PROVIDER=anthropic` and
`ANTHROPIC_API_KEY=...` in `.env`, then run the same `analyze` command.

## CLI reference

| Command | Purpose |
|---|---|
| `ingest` | Persist one piece of evidence (dedup per workspace). |
| `analyze` | Ingest (or reference) evidence, then run the full workflow to a brief. |
| `fetch --workspace <slug> --url <url>` | Fetch a URL under SSRF controls; store as `fetched` evidence. |
| `source:add --workspace <slug> --url <url>` | Register a research source (validated at add time). |
| `source:list --workspace <slug>` | List a workspace's research sources. |
| `research --workspace <slug>` | Collect every enabled source into `fetched` evidence (per-source resilient). |
| `workspace:list` | List all workspaces. |
| `workspace:show --workspace <slug>` | Show a workspace with evidence/run/signal/brief counts. |
| `evidence:list --workspace <slug>` | List a workspace's evidence (paginated). |
| `run:list --workspace <slug>` | List runs (optional `--status`, paginated). |
| `run:show --run <id>` | Show a run's status, stage, tokens, signal count, identity, error. |
| `run:resume --run <id>` | Resume an interrupted/failed run from its last durable stage. |
| `signal:list --run <id>` | List the signals extracted by a run. |
| `brief:list --workspace <slug>` | List a workspace's briefs (paginated). |
| `audit:list --run <id>` / `--workspace <slug>` | List the agent-action audit trail. |
| `brief:show --run <id>` | Print the rendered Founder Brief (Markdown). |
| `brief:export --run <id> --out <path>` | Write the brief to a file. |
| `brief:request-delivery --workspace <slug> --run <id> --to <dest>` | Propose a (gated) brief delivery — persists PENDING, does nothing. |
| `approval:list --workspace <slug>` | List approval requests (optional `--status`). |
| `approval:approve --id <id>` / `approval:deny --id <id>` | Human decision on a pending approval. |
| `brief:deliver --approval <id>` | Execute a delivery — only if APPROVED (delivery is **simulated**). |

**`analyze` flags:** `--workspace <slug>` (required); either `--evidence <id> [<id>…]`
(multiple ids analyze several sources in one run) or an inline `--file <path>
--source-url <url> --source-name <name> --retrieved-at <iso>`; optional
`--idempotency-key <key>` and `--executor <id>` (default `local-cli`).
**`source:add`** also accepts `--kind web_page|hacker_news|github_releases`
(default `web_page`) and `--label`. **List commands** accept `--limit <n>`
(default 20, max 100) and `--offset <n>`.

## Key concepts

### Retry vs. reprocess

- **Retry** — reuse the same `--idempotency-key`. Resumes the same run at its last
  durable stage; already-persisted signals/brief are not redone.
- **Reprocess** — use a new `--idempotency-key` (typically with a bumped workflow
  or prompt version). A brand-new run with its own signals and brief.

### Research & scheduling

Register sources once, then collect them repeatedly:

```bash
npm run growth -- source:add --workspace sytadel --url https://competitor.com/changelog --label "Competitor changelog"
npm run growth -- source:add --workspace sytadel --kind hacker_news \
  --url "https://hn.algolia.com/api/v1/search?query=agent%20identity&tags=story" --label "HN: agent identity"
npm run growth -- research  --workspace sytadel          # collects all enabled sources
npm run growth -- analyze   --workspace sytadel --evidence <id> [<id> ...]
```

A `research` run is **resilient**: one source failing (blocked, timeout, empty) is
recorded in the per-source outcome and the batch continues; content dedups by
hash, so re-running is safe. Scheduling is external and cron-friendly (no
long-running server):

```cron
0 * * * * cd /path/to/sytadel-growth-os && npm run growth -- research --workspace sytadel >> research.log 2>&1
```

### Identity

By default runs use a **local operator identity** (`executor_id`). Setting
`GROWTH_SYTADEL_AUTH=true` (plus the `GROWTH_SYTADEL_*` credentials) makes Growth
OS authenticate as an `auth-api` **ServiceAccount** and attribute each run to that
Sytadel principal (`sytadel_subject` + tenant) **in addition to** the local
identity — the two are never conflated.

Growth OS is a **client**: it presents its ServiceAccount secret to the existing
`auth-api` token endpoint and reads the returned principal; it does not verify
anyone else's tokens. If auth is enabled and fails, the run **fails visibly** —
there is no silent fallback to local identity. Real use requires a tenant with the
`apiAuth` entitlement plus a ClientApp + ServiceAccount provisioned in your
`auth-api`.

**Scope enforcement.** When Sytadel auth is on, operations require the
principal to hold the matching scope: `research:read` to run an analysis,
`research:fetch` to fetch a URL or run a research collection. A missing scope
fails the operation with a `ScopeDeniedError` (the local-identity path is
unaffected and keeps its existing guards). Note: these `research:*` scopes are
added to `auth-api`'s closed allowlist in a **separate `sytadel-suite` PR** (not
yet opened), so until that lands a real ServiceAccount cannot hold them — meaning
Sytadel-auth'd research is intentionally gated. Vault-held secrets, audit
emission, and HITL are later increments — see [ADR 0002](docs/adr/0002-governance.md).

### Audit

Every run emits an **append-only** agent-action trail (`run.started`,
`run.completed`, `run.failed`) carrying both identities (local executor + the
Sytadel principal when present) and small, sanitized metadata (stage, versions,
token usage, sanitized error). It **never** records secrets, tokens, or source
content. Auditing is failure-isolated — an audit write can never break the run it
describes. Inspect it with `audit:list --run <id>` or `--workspace <slug>`.
Forwarding the trail to the suite's unified audit timeline is a later,
suite-touching increment.

### Human-in-the-loop (HITL)

Any action with an external side effect (send / publish / spend) must be
**approved by a human before it runs** — the invariant that **outranks any scope
grant**. There is no such action yet, so the mechanism is proven with a
representative gated action: a **simulated** brief delivery (no real outbound).

```bash
npm run growth -- brief:request-delivery --workspace sytadel --run <id> --to ops@acme.com   # → PENDING, does nothing
npm run growth -- brief:deliver --approval <id>    # rejected: not approved
npm run growth -- approval:approve --id <id>
npm run growth -- brief:deliver --approval <id>    # [simulated] delivers; then marked executed
```

Proposing persists a `PENDING` request and stops; execution requires an
`APPROVED`, un-executed request (no replay); `DENIED`/`EXPIRED` are terminal.
Every step is audited.

## Project layout

```
src/
  cli/                 # CLI entrypoint + commands (no HTTP server)
  config/              # zod-validated configuration
  common/              # enums, errors, hashing, html→text, pagination
  database/            # data-source + explicit migrations
  modules/
    workspaces/        # isolation boundary
    evidence/          # ingest + dedup
    runs/              # AgentRun + orchestrator (state machine, resume, budget)
    signals/           # MarketSignal + reference-integrity guard
    briefs/            # FounderBrief + Markdown renderer + calibration
    analysis/          # the deterministic workflow + versioned prompts
    llm/               # provider interface (Anthropic + fixture) + runner
    fetch/             # SSRF guard + hardened HTTP fetcher
    research/          # source registry + connectors
    identity/          # opt-in Sytadel ServiceAccount auth + scope enforcement
    secrets/           # SecretProvider seam (env-backed; swap point for a real backend)
    audit/             # append-only agent-action audit trail
    approvals/         # human-in-the-loop approval gate
docs/
  adr/                 # architecture decision records
  integration/         # verified Sytadel integration surface
  mvp/                 # per-slice specs & verification checklists
  roadmap.md           # the full Growth AI plan
  next-slice-prompt.md # how to continue
test/                  # unit + integration (fixtures; no external network in CI)
```

## Development

```bash
npm run typecheck
npm run lint
npm run build
npm test        # needs a migrated Postgres; uses the fixture provider — no keys
```

Tests never call a real model or the external network (a local HTTP server backs
fetch/connector/identity tests). Do not weaken a test to make it pass. CI runs
install → typecheck → build → migrate → test with the fixture provider.

## Roadmap & docs

- [`docs/roadmap.md`](docs/roadmap.md) — the full multi-agent Growth AI plan.
- [`docs/adr/`](docs/adr) — decisions: [0001](docs/adr/0001-private-separation-and-sytadel-boundaries.md)
  (private separation & boundaries), [0002](docs/adr/0002-governance.md) (governance).
- [`docs/integration/sytadel-capabilities.md`](docs/integration/sytadel-capabilities.md)
  — verified Sytadel integration surface.
- [`docs/mvp/`](docs/mvp) — per-slice specs & verification checklists.
- [`docs/next-slice-prompt.md`](docs/next-slice-prompt.md) — how to continue.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
