# Next-slice prompt

Copy-paste to continue the build. Do discovery first; do not assume anything not
verified in this repo or in `sytadel-suite`.

## Recommended next: Slice 2 — Core hardening

> Extend Sytadel Growth OS with Slice 2 (no external effects, still CLI-first).
>
> 1. **Multi-evidence runs:** `analyze` should accept several `--file`/`--evidence`
>    inputs; the analysis step must handle N evidence blocks and keep the
>    `evidenceRef` → id mapping correct and validated.
> 2. **Workspace management:** `workspace:list`, `workspace:show <slug>` (counts of
>    evidence/runs/briefs); keep strict isolation.
> 3. **Brief/run querying:** `run:list --workspace <slug>` and `brief:list`, with a
>    stable, paginated ordering.
> 4. **Signal taxonomy & calibration:** richer categories and a confidence
>    calibration note in the brief; keep fact-vs-hypothesis separation.
>
> Constraints unchanged: deterministic around the model, schema-validated output,
> DB-enforced idempotency/dedup, sanitized errors, workspace isolation, fixtures in
> tests/CI (no provider keys), no web fetch, no HTTP data endpoints. Add a
> migration if the schema changes. Do not modify `sytadel-suite`.

## Then: Slice 3 — Autonomous research + Governance begins

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
