import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AppConfig } from '../../config/configuration';

/** The authenticated Sytadel principal, read from the token response. */
export type SytadelPrincipal = {
  tenantId: string;
  tenantSlug: string;
  serviceAccountId: string;
  clientAppId: string;
  scopes: string[];
};

/** Raised for any Sytadel authentication failure. Message is safe to log. */
export class SytadelAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SytadelAuthError';
  }
}

/** Shape of auth-api's service-account-token response we rely on. */
const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().positive(),
  tenant: z.object({ id: z.string(), slug: z.string() }),
  serviceAccount: z.object({
    id: z.string(),
    clientAppId: z.string(),
    scopes: z.array(z.string()),
  }),
});

/**
 * Authenticates Growth OS as an auth-api ServiceAccount and exposes the
 * resulting principal. Growth OS is a CLIENT here: it presents its credentials
 * over the wire and reads the returned principal; it does not verify anyone
 * else's tokens. The short-lived access token is cached in memory only, never
 * persisted, and neither the token nor the secret is ever logged.
 *
 * Feature-flagged: when disabled, getPrincipal() returns null and runs keep
 * their local operator identity. When enabled, an auth failure is surfaced (no
 * silent fallback to local identity).
 */
@Injectable()
export class SytadelIdentityService {
  private readonly logger = new Logger(SytadelIdentityService.name);
  private cache?: { principal: SytadelPrincipal; token: string; expiresAt: number };

  constructor(private readonly cfg: AppConfig['sytadel']) {}

  isEnabled(): boolean {
    return this.cfg.enabled;
  }

  /** The authenticated principal, or null when Sytadel auth is disabled. */
  async getPrincipal(): Promise<SytadelPrincipal | null> {
    if (!this.cfg.enabled) return null;
    return this.authenticate();
  }

  private async authenticate(): Promise<SytadelPrincipal> {
    const now = Date.now();
    // Reuse a cached principal while its token is comfortably unexpired.
    if (this.cache && now < this.cache.expiresAt - 5_000) {
      return this.cache.principal;
    }

    const { authUrl, tenantSlug, clientAppId, serviceAccountId, clientSecret } =
      this.cfg;
    if (
      !authUrl ||
      !tenantSlug ||
      !clientAppId ||
      !serviceAccountId ||
      !clientSecret
    ) {
      throw new SytadelAuthError(
        'Sytadel auth is enabled but not fully configured',
      );
    }

    let res: Response;
    try {
      res = await fetch(`${authUrl}/integrations/service-account-token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          clientAppId,
          serviceAccountId,
          clientSecret,
        }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : 'unknown';
      throw new SytadelAuthError(`Sytadel auth request failed (${name})`);
    }

    if (!res.ok) {
      throw new SytadelAuthError(`Sytadel auth rejected (status ${res.status})`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new SytadelAuthError('Sytadel auth returned invalid JSON');
    }
    const parsed = tokenResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new SytadelAuthError('Sytadel auth returned an unexpected shape');
    }

    const principal: SytadelPrincipal = {
      tenantId: parsed.data.tenant.id,
      tenantSlug: parsed.data.tenant.slug,
      serviceAccountId: parsed.data.serviceAccount.id,
      clientAppId: parsed.data.serviceAccount.clientAppId,
      scopes: parsed.data.serviceAccount.scopes,
    };
    this.cache = {
      principal,
      token: parsed.data.accessToken,
      expiresAt: now + parsed.data.accessTokenExpiresIn * 1_000,
    };
    this.logger.log(
      `Authenticated Sytadel principal sa=${principal.serviceAccountId} tenant=${principal.tenantSlug} scopes=[${principal.scopes.join(',')}]`,
    );
    return principal;
  }
}
