# Slice 3a — Hardened web fetch: spec & checklist

## Goal

Give Growth OS its first external capability — pulling a URL — **safely**. A
read-only HTTP(S) GET, guarded against SSRF, whose result is stored as untrusted
`fetched` evidence that the existing analysis workflow can consume.

## Scope

**In:**
- `HttpFetcher` (`src/modules/fetch/http-fetcher.ts`): read-only GET with
  connection pinned to a validated IP, manual redirect re-validation, and
  size/time caps.
- SSRF guard (`src/modules/fetch/ssrf.ts`): IPv4/IPv6 classification + URL
  validation.
- `FetchService`: fetch → store as `fetched` evidence (final URL + real fetch
  time), 2xx-only, dedup by content hash.
- CLI `fetch --workspace <slug> --url <url> [--source-name <name>]`.
- Config caps: `GROWTH_FETCH_MAX_REDIRECTS`, `GROWTH_FETCH_MAX_BYTES`,
  `GROWTH_FETCH_TIMEOUT_MS`.

**Out (later slices):** source connectors + scheduling (3b); Sytadel-governed
agent identity / audit / HITL (3c — touches `auth-api` scopes); HTTP data
endpoints; any send/publish/spend.

## Security model (SSRF)

- Protocol allowlist: `http`/`https` only.
- Destination IPs validated at **connect time** via a custom DNS lookup that only
  returns allowed addresses, so the socket connects to exactly the validated IP
  (**DNS-rebinding / TOCTOU** mitigated).
- Blocked ranges (v4 and v6, incl. IPv4-mapped v6): private (10/8, 172.16/12,
  192.168/16), loopback (127/8, ::1), link-local (169.254/16 incl. metadata,
  fe80::/10), unique-local (fc00::/7), CGNAT (100.64/10), multicast, unspecified,
  reserved/broadcast, TEST-NETs.
- Redirects followed manually, **each hop re-validated**, capped.
- Response size + total time bounded; provider/network failures surface as typed
  `FetchError` (never fabricated content).
- Fetched body is stored and treated as **untrusted data**, exactly like manual
  evidence — instructions inside it can never trigger actions.
- Test-only `allowLoopback` escape hatch exists in `FetchPolicy`; it is always
  `false` in the wired module and only set by tests hitting a local server.

## Verification checklist

Offline suite (no network for units; a local HTTP server for the fetcher):

- [x] **IP classification** — public IPs allowed; private/loopback/link-local/
  ULA/CGNAT/metadata/multicast/unspecified + IPv4-mapped v6 blocked
  (`ssrf.spec.ts`).
- [x] **URL validation** — non-http rejected; blocked IP literals (v4 + `[::1]`)
  rejected; relative/garbage rejected; loopback only with the flag
  (`ssrf.spec.ts`).
- [x] **Happy fetch** — 200 body returned with final URL/content-type
  (`http-fetcher.spec.ts`).
- [x] **Redirect followed + re-validated** — same-host redirect works; a redirect
  to a blocked IP is rejected (`http-fetcher.spec.ts`).
- [x] **Redirect cap / size cap / timeout** — each enforced
  (`http-fetcher.spec.ts`).
- [x] **Fetch → evidence** — stored as `fetched` with final URL + fetch time;
  2xx-only; empty body rejected; dedup by hash (`fetch.spec.ts`).
- [x] **Manual smoke** — `fetch` blocks `169.254.169.254` and `127.0.0.1`;
  successfully fetches a benign public page and stores it.

## Try it

```bash
# blocked (SSRF): prints an error, stores nothing
npm run growth -- fetch --workspace sytadel --url http://169.254.169.254/latest

# allowed: stores the page as `fetched` evidence, then analyze it
npm run growth -- fetch --workspace sytadel --url https://example.com
npm run growth -- analyze --workspace sytadel --evidence <evidence-id>
```
