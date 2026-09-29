/**
 * The Sytadel API scopes Growth OS references. These MIRROR the authoritative
 * allowlist in `auth-api` (`src/modules/integrations/api-scopes.ts`) — auth-api
 * is the authority that grants them to a ServiceAccount. Growth OS only enforces
 * that the authenticated principal HOLDS the scope an operation requires.
 *
 * Note: these `research:*` / `leads:*` scopes are being added to auth-api's
 * closed allowlist in a separate `sytadel-suite` PR (Slice 3c-2, suite side).
 * Until that lands, a real ServiceAccount cannot hold them, so Sytadel-auth'd
 * research is gated here (by design) — the local-identity path is unaffected.
 */
export const SYTADEL_SCOPES = {
  /** Read/analyze evidence into signals and briefs. */
  RESEARCH_READ: 'research:read',
  /** Perform outbound research fetches (fetch command + research runs). */
  RESEARCH_FETCH: 'research:fetch',
  /** Read lead data (reserved for Slice 6; not yet enforced). */
  LEADS_READ: 'leads:read',
} as const;

export type SytadelScope = (typeof SYTADEL_SCOPES)[keyof typeof SYTADEL_SCOPES];
