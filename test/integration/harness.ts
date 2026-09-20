import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LLM_PROVIDER } from '../../src/modules/llm/llm-provider.interface';
import {
  FixtureProvider,
  FixtureScript,
} from '../../src/modules/llm/providers/fixture.provider';
import { WorkspaceService } from '../../src/modules/workspaces/workspace.service';
import { EvidenceService } from '../../src/modules/evidence/evidence.service';
import { SignalService } from '../../src/modules/signals/signal.service';
import { BriefService } from '../../src/modules/briefs/brief.service';
import { RunOrchestrator } from '../../src/modules/runs/run-orchestrator.service';

export type TestApp = {
  app: TestingModule;
  dataSource: DataSource;
  workspaces: WorkspaceService;
  evidence: EvidenceService;
  signals: SignalService;
  briefs: BriefService;
  orchestrator: RunOrchestrator;
  close: () => Promise<void>;
};

/**
 * Boot the real application context against the (migrated) test Postgres, with
 * the LLM provider swapped for a scripted fixture. No network, no real key.
 */
export async function createTestApp(script?: FixtureScript): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(new FixtureProvider('fixture-model', script))
    .compile();

  const app = await moduleRef.init();

  return {
    app,
    dataSource: app.get(DataSource),
    workspaces: app.get(WorkspaceService),
    evidence: app.get(EvidenceService),
    signals: app.get(SignalService),
    briefs: app.get(BriefService),
    orchestrator: app.get(RunOrchestrator),
    close: () => app.close(),
  };
}

/** A unique workspace slug so tests never collide, even across reruns. */
export function uniqueSlug(prefix = 'test'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/** Valid analysis JSON citing evidenceRef 1 with the given statement. */
export function analysisJson(
  statement = 'A real market signal',
  evidenceRef = 1,
): string {
  return JSON.stringify({
    signals: [
      {
        category: 'competition',
        kind: 'fact',
        statement,
        evidenceQuote: null,
        confidence: 0.8,
        evidenceRef,
      },
    ],
  });
}

/** Valid brief JSON citing signalRef 1. */
export function briefJson(title = 'Test Brief'): string {
  return JSON.stringify({
    title,
    findings: [{ statement: 'Grounded finding', signalRefs: [1] }],
    implicationsForSytadel: ['Some implication'],
    hypothesesToValidate: ['Some hypothesis'],
    nextExperiment: 'Run a landing test',
    uncertaintyAndCoverage: ['Limited evidence'],
  });
}
