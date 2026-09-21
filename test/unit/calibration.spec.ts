import {
  computeCalibration,
  renderBriefMarkdown,
} from '../../src/modules/briefs/brief-renderer';
import { MarketSignal } from '../../src/modules/signals/entities/market-signal.entity';
import { SignalCategory, SignalKind } from '../../src/common/enums';

function signal(
  id: string,
  kind: SignalKind,
  category: SignalCategory,
  confidence: number,
): MarketSignal {
  const s = new MarketSignal();
  s.id = id;
  s.kind = kind;
  s.category = category;
  s.confidence = confidence;
  s.statement = `stmt-${id}`;
  s.evidenceId = `ev-${id}`;
  return s;
}

describe('computeCalibration', () => {
  it('counts facts/hypotheses, averages confidence, breaks down by category', () => {
    const cal = computeCalibration([
      signal('1', SignalKind.FACT, SignalCategory.PRICING, 0.8),
      signal('2', SignalKind.HYPOTHESIS, SignalCategory.PRICING, 0.4),
      signal('3', SignalKind.FACT, SignalCategory.TREND, 0.6),
    ]);
    expect(cal.total).toBe(3);
    expect(cal.facts).toBe(2);
    expect(cal.hypotheses).toBe(1);
    expect(cal.avgConfidence).toBeCloseTo(0.6, 5);
    expect(cal.byCategory[0]).toEqual({ category: 'pricing', count: 2 });
  });

  it('handles an empty signal set without dividing by zero', () => {
    const cal = computeCalibration([]);
    expect(cal).toEqual({
      total: 0,
      facts: 0,
      hypotheses: 0,
      avgConfidence: 0,
      byCategory: [],
    });
  });
});

describe('renderBriefMarkdown calibration block', () => {
  it('includes a computed, model-independent calibration section', () => {
    const md = renderBriefMarkdown(
      'B',
      {
        findings: [{ statement: 'F', signalIds: ['1'] }],
        implicationsForSytadel: [],
        hypothesesToValidate: [],
        nextExperiment: 'X',
        uncertaintyAndCoverage: [],
      },
      [signal('1', SignalKind.FACT, SignalCategory.MARKET, 0.9)],
    );
    expect(md).toContain('## Signal base (calibration)');
    expect(md).toContain('signals: 1 (facts: 1, hypotheses: 0)');
    expect(md).toContain('not written by the model');
  });
});
