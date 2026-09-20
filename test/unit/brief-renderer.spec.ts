import { renderBriefMarkdown } from '../../src/modules/briefs/brief-renderer';
import { MarketSignal } from '../../src/modules/signals/entities/market-signal.entity';
import { SignalCategory, SignalKind } from '../../src/common/enums';

function signal(id: string): MarketSignal {
  const s = new MarketSignal();
  s.id = id;
  s.category = SignalCategory.MARKET;
  s.kind = SignalKind.FACT;
  s.statement = `stmt-${id}`;
  s.evidenceId = `ev-${id}`;
  return s;
}

describe('renderBriefMarkdown', () => {
  it('renders all epistemic sections with the evidence trail', () => {
    const md = renderBriefMarkdown(
      'My Brief',
      {
        findings: [{ statement: 'F1', signalIds: ['s1'] }],
        implicationsForSytadel: ['I1'],
        hypothesesToValidate: ['H1'],
        nextExperiment: 'Do X',
        uncertaintyAndCoverage: ['U1'],
      },
      [signal('s1')],
    );

    expect(md).toContain('# My Brief');
    expect(md).toContain('## Findings');
    expect(md).toContain('F1');
    expect(md).toContain('evidence: [market/fact] stmt-s1');
    expect(md).toContain('## Implications for Sytadel');
    expect(md).toContain('## Hypotheses to validate');
    expect(md).toContain('## Suggested next experiment');
    expect(md).toContain('Do X');
    expect(md).toContain('## Uncertainty & coverage limits');
  });

  it('marks empty sections explicitly', () => {
    const md = renderBriefMarkdown(
      'Empty',
      {
        findings: [{ statement: 'F', signalIds: [] }],
        implicationsForSytadel: [],
        hypothesesToValidate: [],
        nextExperiment: 'X',
        uncertaintyAndCoverage: [],
      },
      [],
    );
    expect(md).toContain('_None reported._');
  });
});
