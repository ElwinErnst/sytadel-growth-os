# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, expanded taxonomy, calibration summary), Slice 3a (hardened
> web fetch with SSRF controls → `fetched` evidence). See `docs/mvp/`.

## Recommended next: Slice 3b — Source connectors + scheduling

> Build read-only source connectors on top of the Slice 3a fetcher (do NOT
> bypass `HttpFetcher`/SSRF). Each connector turns a source into `fetched`
> evidence with a clear source name and the real fetch time.
>
> 1. Connectors: changelogs, GitHub (releases/repos), Hacker News, Reddit,
>    Product Hunt, pricing pages, job posts, funding news. Keep each connector
>    small; normalize output to plain text evidence.
> 2. A `research` run that fetches a configured set of sources for a workspace,
>    dedups, and can feed straight into `analyze`.
> 3. Scheduling: a way to run a research set on an interval (still no HTTP
>    endpoints; a scheduler/cron entry or a documented external trigger).
>
> Constraints: all fetches go through the hardened fetcher; content is untrusted;
> fixtures in tests/CI (no network in unit tests, local server for integration);
> add migrations if the schema changes. Do not modify `sytadel-suite`.

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
