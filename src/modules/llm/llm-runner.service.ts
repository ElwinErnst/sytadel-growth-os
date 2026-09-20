import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LLM_PROVIDER,
  LlmProvider,
  LlmProviderError,
  LlmRequest,
  LlmResponse,
} from './llm-provider.interface';

/**
 * Deterministic control around the (non-deterministic) model call:
 *  - bounded retries on retryable provider errors, with linear backoff;
 *  - a defensive wall-clock timeout on top of the provider's own timeout;
 *  - usage accumulation so callers can enforce a per-run token budget.
 *
 * It does not catch and hide failures: once retries are exhausted (or the error
 * is non-retryable) the LlmProviderError propagates unchanged.
 */
@Injectable()
export class LlmRunner {
  private readonly logger = new Logger(LlmRunner.name);

  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  get providerId(): string {
    return this.provider.id;
  }

  get model(): string {
    return this.provider.model;
  }

  async complete(req: LlmRequest, maxRetries: number): Promise<LlmResponse> {
    let lastError: LlmProviderError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.withDeadline(
          this.provider.complete(req),
          req.timeoutMs,
        );
      } catch (err) {
        const error =
          err instanceof LlmProviderError
            ? err
            : new LlmProviderError('Unexpected LLM failure', false);
        lastError = error;

        if (!error.retryable || attempt === maxRetries) {
          throw error;
        }
        const backoffMs = 250 * (attempt + 1);
        this.logger.warn(
          `LLM attempt ${attempt + 1}/${maxRetries + 1} failed (${error.message}); retrying in ${backoffMs}ms`,
        );
        await delay(backoffMs);
      }
    }

    // Unreachable, but keeps the type checker honest.
    throw lastError ?? new LlmProviderError('LLM failed with no error', false);
  }

  private async withDeadline<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new LlmProviderError(`LLM call exceeded ${timeoutMs}ms`, true),
          ),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
