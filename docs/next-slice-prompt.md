# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief), Slice 2 (multi-evidence,
> listing/query CLI, taxonomy, calibration), Slice 3a (hardened web fetch, SSRF),
> Slice 3b-1 (connector framework + `web_page`, research registry, resilient
> `research` run, cron), Slice 3b-2 (typed connectors: `hacker_news`,
> `github_releases`). See `docs/mvp/`.

## Recommended next: Slice 3c — Governance (touches `auth-api`)

This is the "en Slice 3 lo vemos" decision — the first change that touches
`sytadel-suite`. Discovery first; confirm the current state of `auth-api`.

- Propose new least-privilege scopes in `auth-api`
  (`src/modules/integrations/api-scopes.ts`) — e.g. `research:read`,
  `research:fetch` — as a **separate PR to `sytadel-suite`** (the allowlist is
  closed; unknown scopes are rejected at key creation).
- Make each agent role an `auth-api` `ServiceAccount`; route calls through
  `zerotrust-api`; move connector/provider secrets to **Vault** (this also
  unlocks key-based connectors like Reddit / Product Hunt); emit agent-action
  audit to the suite's unified timeline; add HITL for any sensitive action.
- Only after this does the local executor identity get replaced by a
  Sytadel-authenticated principal (add a `sytadel_subject` field; never conflate
  it with `executor_id`).

Given this crosses into `sytadel-suite`, confirm scope with the operator before
opening the suite PR.

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
