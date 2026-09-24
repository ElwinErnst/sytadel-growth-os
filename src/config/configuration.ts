import { z } from 'zod';

/**
 * Environment schema. Validated once at boot so a misconfigured process fails
 * loudly instead of surfacing as a confusing runtime error deep in a run.
 * Secrets (ANTHROPIC_API_KEY) come from the environment only — never from
 * source, prompts, or persisted rows.
 */
const envSchema = z.object({
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5440),
  DB_USER: z.string().min(1).default('growth'),
  DB_PASS: z.string().min(1).default('growth-dev-insecure'),
  DB_NAME: z.string().min(1).default('growth_os'),

  GROWTH_LLM_PROVIDER: z.enum(['anthropic', 'fixture']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
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
});

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
    apiKey: string | null;
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
      apiKey: parsed.ANTHROPIC_API_KEY?.trim() || null,
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
  };
}

/** ConfigModule factory. */
export default (): AppConfig => loadConfig();
