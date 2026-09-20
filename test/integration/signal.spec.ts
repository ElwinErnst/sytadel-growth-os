import { SignalCategory, SignalKind } from '../../src/common/enums';
import { ReferenceIntegrityError } from '../../src/common/errors';
import { AnalysisSignal } from '../../src/modules/llm/schemas/analysis.schema';
import { createTestApp, TestApp } from './harness';

describe('SignalService reference integrity', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const signal: AnalysisSignal = {
    category: SignalCategory.MARKET,
    kind: SignalKind.FACT,
    statement: 'x',
    evidenceQuote: null,
    confidence: 0.5,
    evidenceRef: 1,
  };

  it('rejects a signal whose evidence belongs to another workspace', async () => {
    await expect(
      t.signals.persistFromAnalysis(
        'workspace-A',
        'run-1',
        [{ id: 'ev-1', workspaceId: 'workspace-B' }],
        [signal],
      ),
    ).rejects.toBeInstanceOf(ReferenceIntegrityError);
  });

  it('rejects an out-of-range evidence reference', async () => {
    await expect(
      t.signals.persistFromAnalysis(
        'workspace-A',
        'run-1',
        [{ id: 'ev-1', workspaceId: 'workspace-A' }],
        [{ ...signal, evidenceRef: 5 }],
      ),
    ).rejects.toBeInstanceOf(ReferenceIntegrityError);
  });
});
