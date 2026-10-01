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
import { ResearchService } from '../../src/modules/research/research.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { HttpFetcher } from '../../src/modules/fetch/http-fetcher';
import {
  ScopeDeniedError,
  SytadelIdentityService,
  SytadelPrincipal,
} from '../../src/modules/identity/sytadel-identity.service';
import { SytadelScope } from '../../src/modules/identity/scopes';

export type TestApp = {
  app: TestingModule;
  dataSource: DataSource;
  workspaces: WorkspaceService;
  evidence: EvidenceService;
  signals: SignalService;
  briefs: BriefService;
  orchestrator: RunOrchestrator;
  research: ResearchService;
  audit: AuditService;
  close: () => Promise<void>;
};

/**
 * Boot the real application context against the (migrated) test Postgres, with
 * the LLM provider swapped for a scripted fixture. No network, no real key.
 */
export async function createTestApp(
  script?: FixtureScript,
  fetcher?: HttpFetcher,
  identity?: SytadelIdentityService,
): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(new FixtureProvider('fixture-model', script));
  if (fetcher) {
    // Swap the hardened fetcher for a loopback-allowing one so research/fetch
    // tests can hit a local server. Production always uses allowLoopback:false.
    builder = builder.overrideProvider(HttpFetcher).useValue(fetcher);
  }
  if (identity) {
    // Swap the Sytadel identity client for a stub so orchestrator tests can
    // exercise the authenticated-principal path without a real auth-api.
    builder = builder.overrideProvider(SytadelIdentityService).useValue(identity);
  }
  const moduleRef = await builder.compile();

  const app = await moduleRef.init();

  return {
    app,
    dataSource: app.get(DataSource),
    workspaces: app.get(WorkspaceService),
    evidence: app.get(EvidenceService),
    signals: app.get(SignalService),
    briefs: app.get(BriefService),
    orchestrator: app.get(RunOrchestrator),
    research: app.get(ResearchService),
    audit: app.get(AuditService),
    close: () => app.close(),
  };
}

/** A unique workspace slug so tests never collide, even across reruns. */
export function uniqueSlug(prefix = 'test'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * A stub Sytadel identity service. `principal = null` models auth disabled
 * (local identity). Otherwise requireScope enforces the principal's scopes,
 * exactly like the real service.
 */
export function stubIdentity(
  principal: SytadelPrincipal | null,
): SytadelIdentityService {
  return {
    isEnabled: () => principal !== null,
    getPrincipal: async () => principal,
    requireScope: async (scope: SytadelScope) => {
      if (!principal) return null;
      if (!principal.scopes.includes(scope)) throw new ScopeDeniedError(scope);
      return principal;
    },
  } as unknown as SytadelIdentityService;
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
