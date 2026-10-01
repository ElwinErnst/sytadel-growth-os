/**
 * The single seam through which Growth OS reads secrets. Centralizing access
 * here keeps secrets out of the validated config object (which could be logged)
 * and gives one place to swap the env-backed implementation for a real secrets
 * backend (e.g. a KV secrets manager) later — no consumer changes required.
 *
 * The suite has no generic secrets manager and `securechain-vault` is document
 * custody, not a KV store — so the current backend is the environment, matching
 * the rest of the suite. See ADR 0002 and docs/mvp/slice-3c3-*.
 */
export const SECRET_PROVIDER = Symbol('SECRET_PROVIDER');

/** Well-known secret names Growth OS reads. */
export const SECRET_NAMES = {
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  SYTADEL_CLIENT_SECRET: 'GROWTH_SYTADEL_CLIENT_SECRET',
} as const;

export type SecretName = (typeof SECRET_NAMES)[keyof typeof SECRET_NAMES];

export interface SecretProvider {
  /** The secret value, or null if unset/empty. Implementations never log it. */
  get(name: string): string | null;
  /** The secret value, or throws (with the NAME, never the value) if absent. */
  require(name: string): string;
}
