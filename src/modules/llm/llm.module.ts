import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { LLM_PROVIDER, LlmProvider } from './llm-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { FixtureProvider } from './providers/fixture.provider';
import { LlmRunner } from './llm-runner.service';
import {
  SECRET_NAMES,
  SECRET_PROVIDER,
  SecretProvider,
} from '../secrets/secret-provider';

/**
 * Wires the configured LLM provider. `anthropic` requires a key; if the key is
 * missing we fail fast rather than silently degrade to fixtures — a real run
 * must never be quietly served by canned output.
 */
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, SECRET_PROVIDER],
      useFactory: (
        config: ConfigService,
        secrets: SecretProvider,
      ): LlmProvider => {
        const llm = config.getOrThrow<AppConfig['llm']>('llm');
        const logger = new Logger('LlmModule');

        if (llm.provider === 'fixture') {
          logger.warn(
            'LLM provider is FIXTURE — responses are canned placeholders, not real analysis.',
          );
          return new FixtureProvider(llm.model);
        }

        const apiKey = secrets.get(SECRET_NAMES.ANTHROPIC_API_KEY);
        if (!apiKey) {
          throw new Error(
            'GROWTH_LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY. ' +
              'Set the key, or use GROWTH_LLM_PROVIDER=fixture for offline runs.',
          );
        }
        return new AnthropicProvider(apiKey, llm.model);
      },
    },
    LlmRunner,
  ],
  exports: [LLM_PROVIDER, LlmRunner],
})
export class LlmModule {}
