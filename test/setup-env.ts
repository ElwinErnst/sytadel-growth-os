/**
 * Test env defaults. Integration tests need a migrated Postgres (compose brings
 * one up on :5440; CI runs `migration:run` first). We never require a real LLM
 * key: the provider defaults to `fixture` and scripted tests override it.
 */
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5440';
process.env.DB_USER ??= 'growth';
process.env.DB_PASS ??= 'growth-dev-insecure';
process.env.DB_NAME ??= 'growth_os';
process.env.GROWTH_LLM_PROVIDER = 'fixture';
delete process.env.ANTHROPIC_API_KEY;
