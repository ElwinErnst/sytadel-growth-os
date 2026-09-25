# Slice 3b-1 — Source connectors + research runs: spec & checklist

## Goal

Turn the raw fetch capability (Slice 3a) into repeatable research: a per-workspace
registry of sources and a resilient `research` run that collects them into
normalized `fetched` evidence, ready for `analyze`.

## Scope

**In:**
- Connector contract (`src/modules/research/connectors/connector.ts`) — every
  connector fetches through the hardened `HttpFetcher`; no other network path.
- `WebPageConnector` — generic fetch + HTML→text (`src/common/util/html.ts`).
- `ResearchSource` entity + registry (add/list), `research_sources` migration.
- `ResearchService.run` — collects enabled sources, stores each as `fetched`
  evidence, **resilient per source** (one failure is recorded, batch continues),
  returns per-source outcomes.
- CLI: `source:add`, `source:list`, `research [--source <id> ...]`.
- Scheduling: cron-friendly (schedule the CLI); no long-running server.

**Out:** typed connectors — Hacker News, GitHub, Reddit, Product Hunt (Slice
3b-2); HTTP endpoints; Sytadel-governed identity (3c). No send/publish/spend.

## Design notes

- `web_page` is the only `SourceKind` implemented; the connector map makes adding
  typed kinds a local change (implement `Connector`, register it).
- `source:add` validates the URL (incl. SSRF classification) at registration for
  fast feedback; blocked/invalid URLs are rejected up front.
- Collection still goes through SSRF controls at run time (the fetcher re-checks
  and pins the IP). A blocked source surfaces as a failed outcome, not a crash.
- Fetched HTML is normalized to text but remains **untrusted data** — instructions
  inside a page never become instructions to the system.
- `research` exits non-zero only if every source failed; partial success is
  success (cron-friendly).

## Verification checklist

Offline suite (unit + local HTTP server; no external network):

- [x] **HTML→text** — drops script/style, strips tags, decodes entities,
  collapses whitespace, keeps embedded "instructions" as plain text
  (`html.spec.ts`).
- [x] **Registry** — `addSource` validates + dedups per (workspace, url); blocked
  URLs rejected at add time (`research.spec.ts`).
- [x] **Run → evidence** — a `web_page` source becomes normalized `fetched`
  evidence (no tags, no script) (`research.spec.ts`).
- [x] **Resilience** — one failing source (404) does not abort the batch; outcome
  records the error (`research.spec.ts`).
- [x] **Dedup across runs** — repeated runs converge on one evidence row
  (`research.spec.ts`).
- [x] **Manual smoke** — `source:add` (allowed + blocked), `research` against a
  benign public page stores normalized evidence.

## Try it

```bash
npm run growth -- source:add --workspace sytadel --url https://competitor.com/changelog --label "Changelog"
npm run growth -- research  --workspace sytadel
npm run growth -- analyze   --workspace sytadel --evidence <id>
```
