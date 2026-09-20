import { LlmRunner } from '../../src/modules/llm/llm-runner.service';
import {
  LlmProvider,
  LlmProviderError,
  LlmRequest,
  LlmResponse,
} from '../../src/modules/llm/llm-provider.interface';

const req: LlmRequest = {
  system: 's',
  user: 'u',
  maxTokens: 10,
  timeoutMs: 100,
};

function ok(text = 'ok'): LlmResponse {
  return { text, model: 'm', usage: { inputTokens: 1, outputTokens: 1 } };
}

class ProgrammableProvider implements LlmProvider {
  readonly id = 'test';
  readonly model = 'm';
  calls = 0;
  constructor(private readonly steps: Array<() => Promise<LlmResponse>>) {}
  complete(): Promise<LlmResponse> {
    const step = this.steps[this.calls] ?? this.steps[this.steps.length - 1];
    this.calls++;
    return step!();
  }
}

describe('LlmRunner', () => {
  it('retries a retryable error, then succeeds', async () => {
    const provider = new ProgrammableProvider([
      () => Promise.reject(new LlmProviderError('transient', true)),
      () => Promise.resolve(ok('recovered')),
    ]);
    const runner = new LlmRunner(provider);
    const res = await runner.complete(req, 2);
    expect(res.text).toBe('recovered');
    expect(provider.calls).toBe(2);
  });

  it('does not retry a non-retryable error', async () => {
    const provider = new ProgrammableProvider([
      () => Promise.reject(new LlmProviderError('bad request', false)),
    ]);
    const runner = new LlmRunner(provider);
    await expect(runner.complete(req, 3)).rejects.toThrow('bad request');
    expect(provider.calls).toBe(1);
  });

  it('gives up after exhausting retries', async () => {
    const provider = new ProgrammableProvider([
      () => Promise.reject(new LlmProviderError('always', true)),
    ]);
    const runner = new LlmRunner(provider);
    await expect(runner.complete(req, 2)).rejects.toThrow('always');
    expect(provider.calls).toBe(3); // 1 + 2 retries
  });

  it('enforces a wall-clock deadline', async () => {
    const provider = new ProgrammableProvider([
      () => new Promise<LlmResponse>(() => {}), // never resolves
    ]);
    const runner = new LlmRunner(provider);
    await expect(
      runner.complete({ ...req, timeoutMs: 20 }, 0),
    ).rejects.toThrow(/exceeded 20ms/);
  });
});
