import { RunStatus } from '../../src/common/enums';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';
import {
  ScopeDeniedError,
  SytadelAuthError,
  SytadelIdentityService,
  SytadelPrincipal,
} from '../../src/modules/identity/sytadel-identity.service';
import {
  analysisJson,
  briefJson,
  createTestApp,
  stubIdentity,
  TestApp,
  uniqueSlug,
} from './harness';

function stepScript(analysis: string, brief: string) {
  return (req: { system: string }) =>
    req.system.includes(STEP_MARKER.analysis) ? analysis : brief;
}

/** Stub identity service whose auth always fails. */
function failingIdentity(): SytadelIdentityService {
  const boom = () => {
    throw new SytadelAuthError('Sytadel auth rejected (status 401)');
  };
  return {
    isEnabled: () => true,
    getPrincipal: async () => boom(),
    requireScope: async () => boom(),
  } as unknown as SytadelIdentityService;
}

const principal: SytadelPrincipal = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantSlug: 'acme',
  serviceAccountId: 'sa-1',
  clientAppId: 'app-1',
  scopes: ['research:read', 'research:fetch'],
};

async function ingestOne(t: TestApp) {
  const workspace = await t.workspaces.getOrCreate(uniqueSlug());
  const evidence = await t.evidence.ingest({
    workspaceId: workspace.id,
    sourceName: 'src',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date('2026-09-27T00:00:00Z'),
    content: 'content',
  });
  return { workspace, evidenceId: evidence.id };
}

describe('RunOrchestrator × Sytadel identity (integration)', () => {
  it('records only the local identity when Sytadel auth is disabled (default)', async () => {
    const t = await createTestApp(stepScript(analysisJson('a real signal'), briefJson()));
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'local-cli',
      });
      expect(run.status).toBe(RunStatus.COMPLETED);
      expect(run.sytadelSubject).toBeNull();
      expect(run.sytadelTenantId).toBeNull();
    } finally {
      await t.close();
    }
  });

  it('attributes the run to the Sytadel principal when authenticated', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('a real signal'), briefJson()),
      undefined,
      stubIdentity(principal),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'local-cli',
      });
      expect(run.status).toBe(RunStatus.COMPLETED);
      expect(run.sytadelSubject).toBe('sa-1');
      expect(run.sytadelTenantId).toBe(principal.tenantId);
      // Local executor identity is preserved, not replaced.
      expect(run.executorId).toBe('local-cli');
    } finally {
      await t.close();
    }
  });

  it('denies the run when the principal lacks research:read (no run created)', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('a real signal'), briefJson()),
      undefined,
      stubIdentity({ ...principal, scopes: ['payments:read'] }), // wrong scope
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      await expect(
        t.orchestrator.startRun({
          workspace,
          evidenceIds: [evidenceId],
          idempotencyKey: uniqueSlug('key'),
          executorId: 'local-cli',
        }),
      ).rejects.toBeInstanceOf(ScopeDeniedError);
      const runs = await t.orchestrator.listRuns(workspace.id, {
        limit: 20,
        offset: 0,
      });
      expect(runs).toHaveLength(0);
    } finally {
      await t.close();
    }
  });

  it('fails visibly on auth error and creates no run (no silent local fallback)', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('a real signal'), briefJson()),
      undefined,
      failingIdentity(),
    );
    try {
      const workspace = await t.workspaces.getOrCreate(uniqueSlug());
      const evidence = await t.evidence.ingest({
        workspaceId: workspace.id,
        sourceName: 'src',
        sourceUrl: 'https://example.com',
        retrievedAt: new Date('2026-09-27T00:00:00Z'),
        content: 'content',
      });
      await expect(
        t.orchestrator.startRun({
          workspace,
          evidenceIds: [evidence.id],
          idempotencyKey: uniqueSlug('key'),
          executorId: 'local-cli',
        }),
      ).rejects.toBeInstanceOf(SytadelAuthError);

      // No run was persisted for this workspace.
      const runs = await t.orchestrator.listRuns(workspace.id, {
        limit: 20,
        offset: 0,
      });
      expect(runs).toHaveLength(0);
    } finally {
      await t.close();
    }
  });
});
