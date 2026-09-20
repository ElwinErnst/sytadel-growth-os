/**
 * Small provider-agnostic interface for a single text completion. The workflow
 * builds deterministic prompts and validates structured output around this call
 * so the model is the only non-deterministic hop.
 */
export type LlmRequest = {
  /** System prompt: fixed instructions and guardrails (trusted). */
  system: string;
  /** User prompt: task + evidence. Evidence content is untrusted data. */
  user: string;
  maxTokens: number;
  timeoutMs: number;
  /** Kept low/zero for reproducibility of structured extraction. */
  temperature?: number;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmResponse = {
  text: string;
  model: string;
  usage: LlmUsage;
};

/** Raised for any provider-side failure. Message is safe to persist/log. */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  /** Stable identifier persisted on the run (e.g. `anthropic`, `fixture`). */
  readonly id: string;
  /** Model identifier this provider will use. */
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}
