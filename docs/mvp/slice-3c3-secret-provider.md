# Slice 3c-3 — SecretProvider seam: spec & checklist

## Goal

Give secrets a single, swappable access seam. ADR 0002 called this "secrets to
Vault", but discovery corrected the premise: the suite has **no secrets manager**
and `securechain-vault` is document custody (encrypted docs + audit + notarization
via the zerotrust gateway), **not** a KV store. So 3c-3 is reframed to a
`SecretProvider` abstraction with an env-backed implementation — no backend
lock-in, no suite dependency — matching how the rest of the suite handles secrets
(environment) today, while creating one place to swap in a real backend later.

## Scope

**In:**
- `src/modules/secrets/secret-provider.ts` — `SecretProvider` interface
  (`get`/`require`), `SECRET_PROVIDER` token, `SECRET_NAMES`.
- `EnvSecretProvider` — reads `process.env` (snapshot injectable for tests);
  trims; empty→null; `require` throws with the NAME (never the value).
- `@Global SecretsModule` providing the token.
- **Route existing secrets through it:** `ANTHROPIC_API_KEY` (LlmModule) and
  `GROWTH_SYTADEL_CLIENT_SECRET` (IdentityModule) are removed from the validated
  config and read via `SecretProvider`, so secrets no longer live on the config
  object.

**Out:** a real external secrets backend (KV / cloud SM / HashiCorp Vault) — the
seam makes it a one-file swap when chosen; `DB_PASS` stays infra config; audit
(3c-4); HITL (3c-5).

## Design notes

- Secrets were previously parsed into `AppConfig` (`llm.apiKey`,
  `sytadel.clientSecret`). They are now excluded from config entirely and fetched
  by name from the provider at construction — a real defense against a config
  dump leaking a key.
- The Sytadel-auth config `refine` no longer requires the client secret (secrets
  aren't config); `SytadelIdentityService` still enforces its presence at auth
  time and fails visibly if missing.
- Env var NAMES are unchanged, so `.env.example` and existing setups keep working.

## Verification checklist

Offline suite (no external network):

- [x] **EnvSecretProvider** — present (trimmed) value; unset/empty/blank → null;
  `require` returns or throws with the name; defaults to `process.env`
  (`env-secret-provider.spec.ts`).
- [x] **Wiring intact** — LLM and identity factories resolve their secret via the
  provider; the full suite stays green (127 tests) with the fixture provider and
  auth off.
- [x] **No secret on config** — `AppConfig` no longer carries `apiKey` /
  `clientSecret` (typecheck enforces their removal).

## Swapping the backend (later)

Implement `SecretProvider` against the chosen store and change the `useFactory`
in `secrets.module.ts`. No consumer (LLM, identity, future connectors) changes.
