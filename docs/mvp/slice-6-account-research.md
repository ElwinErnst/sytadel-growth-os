# Slice 6 (core) — Account Research + ICP-fit scoring: spec & checklist

## Goal

Start the Lead Gen / Account Research track with a **local** core: register
candidate companies (operator-supplied profiles) and **score each against the
latest ICP**. Deterministic around the model, grounded in the ICP's segments.

## Scope

**In:**
- `Account` entity (workspace, name, `name_key` dedup, domain?, operator `notes`)
  + `AccountAssessment` entity (per account × ICP version: fit score, derived
  tier, matched segments, rationale, gaps, next step) + migration.
- `AccountAssessmentWorkflow` (versioned prompts + zod schema): given the latest
  ICP + an account profile, produce a fit assessment; `matchedSegmentRefs` are
  1-based into the ICP segments and mapped back with reference-integrity.
- `AccountService`: `add` (dedup), `list`, `getById`, `score` (uses latest ICP,
  scope-gated `research:read`, audited `account.scored`), `latestAssessment`.
- CLI `account:add` / `account:list` / `account:score` / `account:show`.

**Out (Slice 6b / later):** automated lead **discovery** and **enrichment** via
fetch (must go through the hardened fetcher + `research:fetch`); **contacts**;
any outbound (HITL-gated). The funnel report ("N analyzed / M ICP / K strong…")
is Slice 7 (Qualification).

## Design notes

- An account's `notes` is operator-supplied and treated as **untrusted data**
  (the prompt fences it and forbids following instructions inside it).
- `tier` is derived in code from `fitScore` (≥0.7 strong, ≥0.4 medium, else weak)
  — not chosen by the model. See `tierFromScore`.
- Assessments append (history); re-scoring records a new row against the current
  ICP version. `account:show`/`list` surface the latest.
- Scoring requires an ICP (`NoIcpError`) and at least one account
  (`NoAccountsError`); the scope check runs first.

## Verification checklist

Offline suite (fixture provider + identity stub; no external network):

- [x] **Add + dedup** — same normalized name → same account (`accounts.spec.ts`).
- [x] **Grounded scoring** — assessment maps to a real ICP segment name; tier
  derived from score; `account.scored` audited (`accounts.spec.ts`).
- [x] **Invented ref rejected** — out-of-range `segmentRef` → `ReferenceIntegrityError`
  (`accounts.spec.ts`).
- [x] **Tier thresholds** — 0.7/0.4 boundaries (`account-tier.spec.ts`).
- [x] **No ICP / no accounts** — `NoIcpError` / `NoAccountsError`
  (`accounts.spec.ts`).
- [x] **Scope denied** — principal without `research:read` → `ScopeDeniedError`
  (`accounts.spec.ts`).
- [x] **Manual smoke** — analyze → icp:generate → account:add → account:score →
  account:show.

## Try it

```bash
npm run growth -- icp:generate  --workspace sytadel
npm run growth -- account:add   --workspace sytadel --name "Agentify" --notes "multi-tenant SaaS shipping AI agents"
npm run growth -- account:score --workspace sytadel
npm run growth -- account:show  --workspace sytadel --account <id>
```
