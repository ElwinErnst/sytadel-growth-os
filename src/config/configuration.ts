import { z } from 'zod';

/**
 * Environment schema. Validated once at boot so a misconfigured process fails
 * loudly instead of surfacing as a confusing runtime error deep in a run.
 *
 * SECRETS are deliberately NOT part of this config — `ANTHROPIC_API_KEY` and
 * `GROWTH_SYTADEL_CLIENT_SECRET` are read only through the SecretProvider seam
 * (src/modules/secrets), so they never live on the config object that could be
 * logged.
 */
const envSchema = z.object({
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5440),
  DB_USER: z.string().min(1).default('growth'),
  DB_PASS: z.string().min(1).default('growth-dev-insecure'),
  DB_NAME: z.string().min(1).default('growth_os'),

  GROWTH_LLM_PROVIDER: z.enum(['anthropic', 'fixture']).default('anthropic'),
  GROWTH_LLM_MODEL: z.string().min(1).default('claude-sonnet-5'),
  GROWTH_LLM_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  GROWTH_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  GROWTH_LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  GROWTH_RUN_TOKEN_BUDGET: z.coerce.number().int().positive().default(20_000),

  GROWTH_FETCH_MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  GROWTH_FETCH_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2_000_000),
  GROWTH_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Sytadel identity (Slice 3c-1). When enabled, runs authenticate as an
  // auth-api ServiceAccount and are attributed to that principal. Off by
  // default → local operator identity, as before.
  GROWTH_SYTADEL_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  GROWTH_SYTADEL_AUTH_URL: z.string().optional(),
  GROWTH_SYTADEL_TENANT_SLUG: z.string().optional(),
  GROWTH_SYTADEL_CLIENT_APP_ID: z.string().optional(),
  GROWTH_SYTADEL_SERVICE_ACCOUNT_ID: z.string().optional(),
  GROWTH_SYTADEL_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
})
  .refine(
    (env) =>
      !env.GROWTH_SYTADEL_AUTH ||
      Boolean(
        env.GROWTH_SYTADEL_AUTH_URL &&
          env.GROWTH_SYTADEL_TENANT_SLUG &&
          env.GROWTH_SYTADEL_CLIENT_APP_ID &&
          env.GROWTH_SYTADEL_SERVICE_ACCOUNT_ID,
      ),
    {
      // The client secret is validated at auth time (via SecretProvider), not
      // here — secrets are not part of config.
      message:
        'GROWTH_SYTADEL_AUTH=true requires GROWTH_SYTADEL_AUTH_URL, ' +
        'GROWTH_SYTADEL_TENANT_SLUG, GROWTH_SYTADEL_CLIENT_APP_ID and ' +
        'GROWTH_SYTADEL_SERVICE_ACCOUNT_ID (client secret comes from the SecretProvider).',
    },
  );

export type AppConfig = {
  db: {
    host: string;
    port: number;
    user: string;
    pass: string;
    name: string;
  };
  llm: {
    provider: 'anthropic' | 'fixture';
    model: string;
    maxTokens: number;
    timeoutMs: number;
    maxRetries: number;
  };
  run: {
    tokenBudget: number;
  };
  fetch: {
    maxRedirects: number;
    maxBytes: number;
    timeoutMs: number;
  };
  sytadel: {
    enabled: boolean;
    authUrl: string | null;
    tenantSlug: string | null;
    clientAppId: string | null;
    serviceAccountId: string | null;
    timeoutMs: number;
  };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    db: {
      host: parsed.DB_HOST,
      port: parsed.DB_PORT,
      user: parsed.DB_USER,
      pass: parsed.DB_PASS,
      name: parsed.DB_NAME,
    },
    llm: {
      provider: parsed.GROWTH_LLM_PROVIDER,
      model: parsed.GROWTH_LLM_MODEL,
      maxTokens: parsed.GROWTH_LLM_MAX_TOKENS,
      timeoutMs: parsed.GROWTH_LLM_TIMEOUT_MS,
      maxRetries: parsed.GROWTH_LLM_MAX_RETRIES,
    },
    run: {
      tokenBudget: parsed.GROWTH_RUN_TOKEN_BUDGET,
    },
    fetch: {
      maxRedirects: parsed.GROWTH_FETCH_MAX_REDIRECTS,
      maxBytes: parsed.GROWTH_FETCH_MAX_BYTES,
      timeoutMs: parsed.GROWTH_FETCH_TIMEOUT_MS,
    },
    sytadel: {
      enabled: parsed.GROWTH_SYTADEL_AUTH,
      authUrl: parsed.GROWTH_SYTADEL_AUTH_URL?.replace(/\/$/, '') ?? null,
      tenantSlug: parsed.GROWTH_SYTADEL_TENANT_SLUG ?? null,
      clientAppId: parsed.GROWTH_SYTADEL_CLIENT_APP_ID ?? null,
      serviceAccountId: parsed.GROWTH_SYTADEL_SERVICE_ACCOUNT_ID ?? null,
      timeoutMs: parsed.GROWTH_SYTADEL_TIMEOUT_MS,
    },
  };
}

/** ConfigModule factory. */
export default (): AppConfig => loadConfig();
