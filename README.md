# Sytadel Growth OS

Private market-research and growth workbench for Sytadel. It turns
operator-supplied evidence into structured signals and an evidence-backed
**Founder Brief**, so the human decides strategy from facts — not vibes.

> **Status: Slice 2 (core hardening).** CLI-only. Core workflow (manual evidence
> → market signals → Founder Brief) plus multi-evidence runs, workspace/run/brief
> listing, and a computed calibration summary in the brief. No web fetching, no
> HTTP data endpoints, no outbound messaging. See
> [`docs/roadmap.md`](docs/roadmap.md) for where this is going.

This is a **separate, private repository**. It is not a Sytadel submodule and is
not part of the Sytadel Compose stack. It integrates with Sytadel only through
verified public APIs, and today it uses a **local operator identity** (Sytadel
identity integration is a later slice — see
[`docs/integration/sytadel-capabilities.md`](docs/integration/sytadel-capabilities.md)).

## What Slice 1 does

```
manual evidence  ->  persisted (untrusted) evidence  ->  structured signals  ->  Founder Brief
```

- **Evidence** is supplied by you (a file + declared source URL + retrieval
  date). Growth OS does **not** visit or verify the URL — it stores what you give
  it and treats the content as untrusted data.
- **Signals** are extracted by an LLM step, schema-validated, and each one must
  cite a piece of evidence that was actually supplied to the run. Invented or
  cross-workspace references are rejected.
- **The Founder Brief** is generated from the persisted signals only. It
  separates findings, implications for Sytadel, hypotheses to validate, a
  suggested next experiment, and explicit uncertainty/coverage limits.

## Design guarantees

- **Deterministic around the model.** Prompts are versioned; output is parsed and
  schema-validated; failures are visible and never replaced with fabricated data.
- **Idempotent & recoverable.** Runs have a persisted state machine. Re-running
  with the same idempotency key resumes from the last durable stage; a new key
  reprocesses. Dedup is enforced by DB constraints, not by read-checks.
- **Bounded.** Timeouts, capped retries, and a per-run token budget.
- **Isolated.** Every row is workspace-scoped; cross-workspace references are
  rejected.
- **Safe by default.** Secrets live in the environment, never in git/prompts/logs.
  Source content is data — instructions inside it can never trigger tools or
  actions (there are none to trigger). Nothing is sent, published, or spent.

## Prerequisites

- Node.js ≥ 20
- Docker (for local Postgres)
- An Anthropic API key **only** for real runs. Offline runs and the whole test
  suite use a deterministic fixture provider and need no key.

## Quickstart

```bash
# 1. Install
npm ci

# 2. Config
cp .env.example .env         # edit if you want a real provider/key

# 3. Local Postgres (isolated from the Sytadel suite, on :5440)
docker compose up -d growth-postgres

# 4. Schema
npm run migration:run

# 5. Run an analysis OFFLINE (no API key needed — fixture provider)
GROWTH_LLM_PROVIDER=fixture npm run growth -- analyze \
  --workspace sytadel \
  --file test/fixtures/sample-evidence.md \
  --source-url https://example.com/pricing \
  --source-name "Competitor snapshot" \
  --retrieved-at 2026-09-20T00:00:00Z
# -> prints a run id

# 6. Read / export the brief
npm run growth -- brief:show --run <run-id>
npm run growth -- brief:export --run <run-id> --out exports/brief.md
```

For a **real** analysis, set `GROWTH_LLM_PROVIDER=anthropic` and
`ANTHROPIC_API_KEY=...` in `.env`, then run the same `analyze` command.

## CLI

| Command | Purpose |
|---|---|
| `ingest` | Persist one piece of evidence (dedup per workspace). |
| `analyze` | Ingest (or reference) evidence, then run the full workflow to a brief. |
| `workspace:list` | List all workspaces. |
| `workspace:show --workspace <slug>` | Show a workspace with evidence/run/signal/brief counts. |
| `evidence:list --workspace <slug>` | List a workspace's evidence (paginated). |
| `run:list --workspace <slug>` | List runs (optional `--status`, paginated). |
| `run:show --run <id>` | Show a run's status, stage, tokens, signal count, error. |
| `run:resume --run <id>` | Resume an interrupted/failed run from its last durable stage. |
| `signal:list --run <id>` | List the signals extracted by a run. |
| `brief:list --workspace <slug>` | List a workspace's briefs (paginated). |
| `brief:show --run <id>` | Print the rendered Founder Brief (Markdown). |
| `brief:export --run <id> --out <path>` | Write the brief to a file. |

`analyze` flags: `--workspace <slug>` (required); either `--evidence <id> [<id>…]`
(multiple ids analyze several sources in one run) or an inline `--file <path>
--source-url <url> --source-name <name> --retrieved-at <iso>`; optional
`--idempotency-key <key>` (omit for a fresh reprocess) and `--executor <id>`
(local operator identity; default `local-cli`).

List commands accept `--limit <n>` (default 20, max 100) and `--offset <n>`.

## Retry vs. reprocess

- **Retry** = same `--idempotency-key`. Resumes the same run at its last durable
  stage; already-persisted signals/brief are not redone.
- **Reprocess** = new `--idempotency-key` (typically alongside a bumped workflow
  or prompt version). A brand-new run with its own signals and brief.

## Development

```bash
npm run typecheck
npm run lint
npm run build
npm test           # needs a migrated Postgres; uses the fixture provider, no keys
```

Tests never call a real model. See [`docs/mvp/slice-1-founder-brief.md`](docs/mvp/slice-1-founder-brief.md)
for the MVP spec and verification checklist.

## Not in Slice 1 (documented next steps)

Web fetching / URL download (with SSRF controls + redirect validation),
scheduling, HTTP data endpoints, Sytadel-governed agent identity, and any action
with an external effect. See [`docs/roadmap.md`](docs/roadmap.md) and
[`docs/next-slice-prompt.md`](docs/next-slice-prompt.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE).
