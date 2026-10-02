import {
  LlmProvider,
  LlmProviderError,
  LlmRequest,
  LlmResponse,
} from '../llm-provider.interface';

/**
 * A response generator. Receives the request and the 0-based call index and
 * returns either a full LlmResponse or just the text (usage defaults to 0).
 * Returning/throwing an LlmProviderError simulates provider failure.
 */
export type FixtureScript = (
  req: LlmRequest,
  callIndex: number,
) => LlmResponse | string | LlmProviderError;

/**
 * Deterministic provider for tests and offline demos. It NEVER calls the
 * network. Pass an explicit `script` in tests to control output precisely; the
 * default heuristic inspects the step marker in the system prompt and returns
 * schema-valid JSON so an end-to-end run works without an API key.
 *
 * Fixture responses are clearly identified as such — this provider must never
 * be substituted for a real provider silently in production paths.
 */
export class FixtureProvider implements LlmProvider {
  readonly id = 'fixture';

  private callIndex = 0;

  constructor(
    readonly model = 'fixture-model',
    private readonly script: FixtureScript = defaultScript,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const result = this.script(req, this.callIndex++);
    if (result instanceof LlmProviderError) {
      throw result;
    }
    if (typeof result === 'string') {
      return { text: result, model: this.model, usage: emptyUsage() };
    }
    return result;
  }
}

function emptyUsage(): { inputTokens: number; outputTokens: number } {
  return { inputTokens: 0, outputTokens: 0 };
}

/** Marker constants shared with the prompt builders. */
export const STEP_MARKER = {
  analysis: 'GROWTH_STEP:ANALYSIS',
  brief: 'GROWTH_STEP:BRIEF',
  icp: 'GROWTH_STEP:ICP',
  account: 'GROWTH_STEP:ACCOUNT',
} as const;

/**
 * Default offline behavior: a minimal, schema-valid response per step. It is
 * intentionally generic (it does not pretend to have read the evidence deeply)
 * so it is obvious the output came from a fixture, not a real analysis.
 */
const defaultScript: FixtureScript = (req) => {
  if (req.system.includes(STEP_MARKER.analysis)) {
    return JSON.stringify({
      signals: [
        {
          category: 'market',
          kind: 'hypothesis',
          statement:
            '[fixture] Placeholder market signal generated offline without a real model.',
          evidenceQuote: null,
          confidence: 0.2,
          evidenceRef: 1,
        },
      ],
    });
  }
  if (req.system.includes(STEP_MARKER.brief)) {
    return JSON.stringify({
      title: '[fixture] Founder Brief (offline)',
      findings: [
        {
          statement:
            '[fixture] Placeholder finding derived from the offline signal.',
          signalRefs: [1],
        },
      ],
      implicationsForSytadel: [
        '[fixture] Run with a real provider for genuine implications.',
      ],
      hypothesesToValidate: ['[fixture] Placeholder hypothesis to validate.'],
      nextExperiment: '[fixture] Configure ANTHROPIC_API_KEY and re-run.',
      uncertaintyAndCoverage: [
        '[fixture] This brief was produced offline; treat all content as placeholder.',
      ],
    });
  }
  if (req.system.includes(STEP_MARKER.icp)) {
    return JSON.stringify({
      title: '[fixture] ICP (offline)',
      summary: '[fixture] Placeholder ICP synthesized offline without a model.',
      segments: [
        {
          name: '[fixture] Placeholder segment',
          description: '[fixture] Derived from the offline signal.',
          signalRefs: [1],
        },
      ],
      idealCharacteristics: ['[fixture] placeholder characteristic'],
      keyPains: [{ pain: '[fixture] placeholder pain', signalRefs: [1] }],
      disqualifiers: ['[fixture] placeholder disqualifier'],
      recommendedBeachhead: '[fixture] Configure ANTHROPIC_API_KEY and re-run.',
      hypothesesToValidate: ['[fixture] placeholder hypothesis'],
      uncertainty: ['[fixture] produced offline; treat as placeholder.'],
    });
  }
  if (req.system.includes(STEP_MARKER.account)) {
    return JSON.stringify({
      fitScore: 0.2,
      matchedSegmentRefs: [],
      rationale: '[fixture] Placeholder assessment produced offline.',
      gaps: ['[fixture] Run with a real provider for a genuine assessment.'],
      recommendedNextStep: '[fixture] Configure ANTHROPIC_API_KEY and re-run.',
    });
  }
  throw new LlmProviderError('Fixture: unrecognized step marker in prompt', false);
};
