import {
  FixtureProvider,
  STEP_MARKER,
} from '../../src/modules/llm/providers/fixture.provider';
import { LlmProviderError } from '../../src/modules/llm/llm-provider.interface';
import { analysisOutputSchema } from '../../src/modules/llm/schemas/analysis.schema';
import { briefOutputSchema } from '../../src/modules/llm/schemas/brief.schema';
import { parseModelJson } from '../../src/common/util/json';

const base = { user: 'u', maxTokens: 10, timeoutMs: 100 };

describe('FixtureProvider default script', () => {
  it('returns schema-valid analysis for the analysis step', async () => {
    const p = new FixtureProvider();
    const res = await p.complete({
      ...base,
      system: `# ${STEP_MARKER.analysis}`,
    });
    expect(() => parseModelJson(res.text, analysisOutputSchema)).not.toThrow();
  });

  it('returns schema-valid brief for the brief step', async () => {
    const p = new FixtureProvider();
    const res = await p.complete({ ...base, system: `# ${STEP_MARKER.brief}` });
    expect(() => parseModelJson(res.text, briefOutputSchema)).not.toThrow();
  });

  it('supports scripted responses and simulated failures', async () => {
    const p = new FixtureProvider('m', (_r, i) =>
      i === 0 ? 'first' : new LlmProviderError('boom', false),
    );
    const first = await p.complete({ ...base, system: 'x' });
    expect(first.text).toBe('first');
    await expect(p.complete({ ...base, system: 'x' })).rejects.toThrow('boom');
  });
});
