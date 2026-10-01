import { SecretProvider } from './secret-provider';

/**
 * Environment-backed secret provider (the current backend). Reads from
 * `process.env` by default; a snapshot can be injected for tests. Values are
 * trimmed; empty is treated as unset. Never logs a secret value.
 */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get(name: string): string | null {
    const value = this.env[name]?.trim();
    return value ? value : null;
  }

  require(name: string): string {
    const value = this.get(name);
    if (value === null) {
      throw new Error(`Missing required secret "${name}"`);
    }
    return value;
  }
}
