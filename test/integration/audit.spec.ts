import { AuditAction, RunStatus } from '../../src/common/enums';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';
import { SytadelPrincipal } from '../../src/modules/identity/sytadel-identity.service';
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

async function ingestOne(t: TestApp) {
  const workspace = await t.workspaces.getOrCreate(uniqueSlug());
  const evidence = await t.evidence.ingest({
    workspaceId: workspace.id,
    sourceName: 'src',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date('2026-10-01T00:00:00Z'),
    content: 'SENSITIVE-SOURCE-CONTENT-should-never-appear-in-audit',
  });
  return { workspace, evidenceId: evidence.id };
}

describe('Agent-action audit (integration)', () => {
  it('records run.started then run.completed on the happy path', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('a real signal'), briefJson()),
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

      const events = await t.audit.listByRun(run.id);
      expect(events.map((e) => e.action)).toEqual([
        AuditAction.RUN_STARTED,
        AuditAction.RUN_COMPLETED,
      ]);
      expect(events.every((e) => e.actorExecutorId === 'local-cli')).toBe(true);
      expect(events.every((e) => e.actorSytadelSubject === null)).toBe(true);

      // Metadata is a small sanitized set — never source content.
      const completed = events[1]!;
      expect(Object.keys(completed.metadata).sort()).toEqual([
        'inputTokens',
        'outputTokens',
        'stage',
      ]);
      const serialized = JSON.stringify(events);
      expect(serialized).not.toContain('SENSITIVE-SOURCE-CONTENT');
    } finally {
      await t.close();
    }
  });

  it('records run.started then run.failed on failure, with a sanitized error', async () => {
    const t = await createTestApp(stepScript('not json at all', briefJson()));
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'local-cli',
      });
      expect(run.status).toBe(RunStatus.FAILED);

      const events = await t.audit.listByRun(run.id);
      expect(events.map((e) => e.action)).toEqual([
        AuditAction.RUN_STARTED,
        AuditAction.RUN_FAILED,
      ]);
      const failed = events[1]!;
      expect(String(failed.metadata.error)).toContain('InvalidModelOutputError');
      expect(JSON.stringify(events)).not.toContain('SENSITIVE-SOURCE-CONTENT');
    } finally {
      await t.close();
    }
  });

  it('attributes audit events to the Sytadel principal when authenticated', async () => {
    const principal: SytadelPrincipal = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      tenantSlug: 'acme',
      serviceAccountId: 'sa-1',
      clientAppId: 'app-1',
      scopes: ['research:read', 'research:fetch'],
    };
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
      const events = await t.audit.listByRun(run.id);
      expect(events.length).toBeGreaterThan(0);
      expect(
        events.every(
          (e) =>
            e.actorSytadelSubject === 'sa-1' &&
            e.actorTenantId === principal.tenantId,
        ),
      ).toBe(true);
    } finally {
      await t.close();
    }
  });
});
