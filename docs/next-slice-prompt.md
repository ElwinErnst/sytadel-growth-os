# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

> **Done:** Slice 1 (evidence → signals → Founder Brief) and Slice 2 (multi-
> evidence, listing/query CLI, expanded taxonomy, calibration summary). See
> `docs/mvp/`.

## Recommended next: Slice 3 — Autonomous research + Governance begins

This is the first slice with an external effect (web fetch), so it **activates the
Governance track**. Before writing fetch code:

- Implement fetch behind an interface with **SSRF controls**: block
  private/link-local/metadata IP ranges, validate every redirect hop (re-resolve
  + connect to the resolved IP), cap redirects, cap response size/time, mitigate
  DNS rebinding. Store fetched content as untrusted `SourceEvidence` with
  `provenance = fetched` and the real fetch timestamp.
- Start the **Governance integration** per `docs/integration/sytadel-capabilities.md`:
  propose the new least-privilege scopes in `auth-api` (`research:read`,
  `research:fetch`, …) as a **separate PR to `sytadel-suite`** (not from this repo
  in a data slice), make each agent a `ServiceAccount`, route calls through
  `zerotrust-api`, move connector secrets to Vault, and emit agent-action audit.

## Guardrail reminders (all slices)

- Agents present evidence; the human decides. No send/publish/spend without HITL.
- Never weaken tests to pass; never claim a check ran if it did not.
- Keep the local executor identity distinct from any future Sytadel identity.
