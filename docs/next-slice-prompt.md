# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, expanded taxonomy, calibration), Slice 3a (hardened web fetch
> with SSRF controls → `fetched` evidence), Slice 3b-1 (connector framework +
> generic `web_page` connector, research source registry, resilient `research`
> run, cron scheduling). See `docs/mvp/`.

## Recommended next: Slice 3b-2 — Typed connectors

> Add typed connectors on the existing contract
> (`src/modules/research/connectors/connector.ts`), one per PR-sized batch. Each
> MUST fetch through the injected `HttpFetcher` (never bypass SSRF) and normalize
> to plain-text evidence.
>
> Good first targets (public, no key needed): **Hacker News** (Algolia search
> API — JSON), then **GitHub** releases/repos (REST, unauthenticated for public
> data). Reddit / Product Hunt need keys → defer or gate behind Vault (3c).
>
> For each: add a `SourceKind`, implement `Connector`, register it in
> `ResearchService`'s connector map, and add integration tests with a local
> server returning canned JSON (no real network in CI).

## Then: Slice 3c — Governance (touches `auth-api`)

This is the "en Slice 3 lo vemos" decision. It is the first change that touches
`sytadel-suite`.

- Propose new least-privilege scopes in `auth-api`
  (`src/modules/integrations/api-scopes.ts`) — e.g. `research:read`,
  `research:fetch` — as a **separate PR to `sytadel-suite`** (the allowlist is
  closed; unknown scopes are rejected at key creation).
- Make each agent role an `auth-api` `ServiceAccount`; route calls through
  `zerotrust-api`; move connector/provider secrets to Vault; emit agent-action
  audit to the suite's unified timeline; add HITL for any sensitive action.
- Only after this does the local executor identity get replaced by a
  Sytadel-authenticated principal (add a `sytadel_subject` field; never conflate
  it with `executor_id`).

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
