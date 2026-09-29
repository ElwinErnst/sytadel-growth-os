import { Global, Module } from '@nestjs/common';
import { SECRET_PROVIDER } from './secret-provider';
import { EnvSecretProvider } from './env-secret-provider';

/**
 * Global so any module can inject SECRET_PROVIDER without importing this. Swap
 * the useFactory for a real secrets backend later — nothing else changes.
 */
@Global()
@Module({
  providers: [{ provide: SECRET_PROVIDER, useFactory: () => new EnvSecretProvider() }],
  exports: [SECRET_PROVIDER],
})
export class SecretsModule {}
