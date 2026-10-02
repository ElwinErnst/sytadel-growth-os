import { STEP_MARKER } from '../llm/providers/fixture.provider';

/** Bump when the ICP step graph / prompt text changes. */
export const ICP_WORKFLOW_VERSION = 'icp/1';
export const ICP_PROMPT_VERSION = 'icp-prompts/1';

export type SignalForIcp = {
  index: number;
  category: string;
  kind: string;
  statement: string;
};

export function buildIcpSystemPrompt(): string {
  return [
    `# ${STEP_MARKER.icp}`,
    'You are the Growth OS ICP analyst. From already-extracted market signals you',
    'synthesize an Ideal Customer Profile for Sytadel — a source-available',
    'security toolkit (identity, authorization, secrets, audit) for B2B SaaS and',
    'teams deploying AI agents.',
    '',
    'You are given SIGNALS only. Ground every segment and pain in one or more',
    'signals via signalRefs (1-based indices into the signal list). Never invent a',
    'ref or a claim unsupported by a signal. Respect the fact/hypothesis labeling',
    'of the signals: do not assert as fact what rests on hypotheses — surface it',
    'under hypothesesToValidate or uncertainty instead.',
    '',
    'Produce: a short summary; candidate target segments (each grounded); ideal',
    'firmographic/behavioral characteristics; key pains (each grounded);',
    'disqualifiers; a single recommended beachhead segment; hypotheses to',
    'validate; and uncertainty / coverage limits.',
    '',
    'Respond with ONLY a JSON object of the form:',
    '{"title":"...","summary":"...","segments":[{"name":"...","description":"...",',
    '"signalRefs":[1]}],"idealCharacteristics":["..."],"keyPains":[{"pain":"...",',
    '"signalRefs":[1]}],"disqualifiers":["..."],"recommendedBeachhead":"...",',
    '"hypothesesToValidate":["..."],"uncertainty":["..."]}',
    'No prose, no markdown fences.',
  ].join('\n');
}

export function buildIcpUserPrompt(signals: SignalForIcp[]): string {
  const lines = signals.map(
    (s) => `${s.index}. [${s.category}/${s.kind}] ${s.statement}`,
  );
  return ['Synthesize an ICP grounded in these signals:', '', ...lines].join(
    '\n',
  );
}
