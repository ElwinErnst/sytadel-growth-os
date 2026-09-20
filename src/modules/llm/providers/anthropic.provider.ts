import Anthropic from '@anthropic-ai/sdk';
import {
  LlmProvider,
  LlmProviderError,
  LlmRequest,
  LlmResponse,
} from '../llm-provider.interface';

/**
 * Real Anthropic-backed provider. Retries are handled by the workflow, not the
 * SDK (`maxRetries: 0`), so retry accounting stays in one place. Any failure is
 * surfaced as an LlmProviderError with a sanitized message — provider errors
 * are never swallowed or replaced with fabricated output.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';

  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0,
          system: req.system,
          messages: [{ role: 'user', content: req.user }],
        },
        { timeout: req.timeoutMs },
      );

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      if (!text) {
        throw new LlmProviderError('Provider returned no text content', true);
      }

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      throw new LlmProviderError(sanitize(err), isRetryable(err));
    }
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    // 408/429 and 5xx are transient; 4xx (auth, bad request) are not.
    return status === 408 || status === 429 || status >= 500;
  }
  // Network errors / timeouts (no status) are treated as transient.
  return true;
}

/** Produce a short, safe error string: no payloads, no secrets. */
function sanitize(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error (status ${err.status ?? 'unknown'})`;
  }
  if (err instanceof Error) {
    return `LLM call failed: ${err.name}`;
  }
  return 'LLM call failed: unknown error';
}
