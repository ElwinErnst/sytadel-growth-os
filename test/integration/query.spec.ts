import { RunStatus } from '../../src/common/enums';
import { analysisJson, briefJson, createTestApp, TestApp, uniqueSlug } from './harness';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';

function stepScript(analysis: string, brief: string) {
  return (req: { system: string }) =>
    req.system.includes(STEP_MARKER.analysis) ? analysis : brief;
}

describe('Query / listing (integration)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp(stepScript(analysisJson('sig'), briefJson()));
  });
  afterAll(async () => {
    await t.close();
  });

  it('paginates and counts evidence, isolated per workspace', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    for (let i = 0; i < 3; i++) {
      await t.evidence.ingest({
        workspaceId: ws.id,
        sourceName: `s${i}`,
        sourceUrl: 'https://example.com',
        retrievedAt: new Date('2026-09-20T00:00:00Z'),
        content: `evidence ${i}`,
      });
    }
    expect(await t.evidence.countByWorkspace(ws.id)).toBe(3);
    const firstPage = await t.evidence.listByWorkspace(ws.id, {
      limit: 2,
      offset: 0,
    });
    const secondPage = await t.evidence.listByWorkspace(ws.id, {
      limit: 2,
      offset: 2,
    });
    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(1);

    const other = await t.workspaces.getOrCreate(uniqueSlug());
    expect(await t.evidence.countByWorkspace(other.id)).toBe(0);
  });

  it('lists runs and briefs for a workspace after a completed run', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const evidence = await t.evidence.ingest({
      workspaceId: ws.id,
      sourceName: 's',
      sourceUrl: 'https://example.com',
      retrievedAt: new Date('2026-09-20T00:00:00Z'),
      content: 'content',
    });
    const run = await t.orchestrator.startRun({
      workspace: ws,
      evidenceIds: [evidence.id],
      idempotencyKey: uniqueSlug('key'),
      executorId: 'tester',
    });
    expect(run.status).toBe(RunStatus.COMPLETED);

    const runs = await t.orchestrator.listRuns(ws.id, { limit: 20, offset: 0 });
    expect(runs).toHaveLength(1);
    expect(await t.orchestrator.countRuns(ws.id)).toBe(1);

    const completed = await t.orchestrator.listRuns(
      ws.id,
      { limit: 20, offset: 0 },
      RunStatus.COMPLETED,
    );
    expect(completed).toHaveLength(1);
    const failed = await t.orchestrator.listRuns(
      ws.id,
      { limit: 20, offset: 0 },
      RunStatus.FAILED,
    );
    expect(failed).toHaveLength(0);

    const briefs = await t.briefs.listByWorkspace(ws.id, {
      limit: 20,
      offset: 0,
    });
    expect(briefs).toHaveLength(1);
    expect(await t.briefs.countByWorkspace(ws.id)).toBe(1);
  });
});
