# Slice 3b-2 — Typed connectors (Hacker News + GitHub): spec & checklist

## Goal

Prove the connector contract with real, keyless JSON-API connectors beyond the
generic web page: **Hacker News** (Algolia search) and **GitHub releases**
(public REST). Both fetch through the hardened `HttpFetcher` and normalize to a
plain-text digest stored as `fetched` evidence.

## Scope

**In:**
- `SourceKind.HACKER_NEWS`, `SourceKind.GITHUB_RELEASES`.
- `HackerNewsConnector`, `GitHubReleasesConnector` — JSON via the shared
  `fetchJson` helper (fetch → 2xx → parse → zod-validate → digest).
- Registered in `ResearchService`'s connector map; `research` routes by kind.
- CLI: `source:add --kind <web_page|hacker_news|github_releases>` with validation
  (unknown kinds rejected).

**Out:** connectors that need API keys — Reddit, Product Hunt — deferred until
secrets live in Vault (Slice 3c). No HTTP endpoints, no Sytadel identity, no
send/publish/spend.

## Design notes

- The source `url` is the source of truth: for `hacker_news` it is the full
  Algolia search URL; for `github_releases` it is the repo releases endpoint. The
  `kind` only selects which parser runs. This keeps connectors keyless and the
  registry uniform.
- JSON is schema-validated (zod, permissive on optional fields); malformed body
  or unexpected shape → `ConnectorError` (recorded as a failed source outcome, so
  the batch still continues — inherited from 3b-1 resilience).
- Each connector emits ONE consolidated digest item per source (bounded item
  count + snippet length). Per-item evidence granularity is a possible future
  refinement.
- GitHub: draft releases are filtered out; prereleases are marked. The hardened
  fetcher's User-Agent satisfies GitHub's UA requirement; unauthenticated calls
  are IP-rate-limited (fine for periodic research).

## Verification checklist

Offline suite (local HTTP server returning canned JSON; no external network):

- [x] **HN digest** — stories digested into one item with points/comments; a hit
  with a null url falls back to the HN item link (`typed-connectors.spec.ts`).
- [x] **GitHub digest** — releases digested; drafts filtered; prereleases marked
  (`typed-connectors.spec.ts`).
- [x] **Empty results** — HN/GitHub empty → `ConnectorError`
  (`typed-connectors.spec.ts`).
- [x] **Malformed** — non-JSON body and unexpected shape → `ConnectorError`
  (`typed-connectors.spec.ts`).
- [x] **Kind persistence** — `addSource` stores a typed kind
  (`research.spec.ts`).
- [x] **CLI validation** — unknown `--kind` rejected (parseKind).

## Try it

```bash
npm run growth -- source:add --workspace sytadel --kind hacker_news \
  --url "https://hn.algolia.com/api/v1/search?query=zero%20trust&tags=story" --label "HN: zero trust"
npm run growth -- research  --workspace sytadel
npm run growth -- analyze   --workspace sytadel --evidence <id>
```
