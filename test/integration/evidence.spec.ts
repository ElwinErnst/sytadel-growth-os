import { SourceEvidence } from '../../src/modules/evidence/entities/source-evidence.entity';
import { createTestApp, TestApp, uniqueSlug } from './harness';

describe('EvidenceService (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const baseInput = (workspaceId: string, content: string) => ({
    workspaceId,
    sourceName: 'src',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date('2026-09-20T00:00:00Z'),
    content,
  });

  it('deduplicates identical content per workspace', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const a = await t.evidence.ingest(baseInput(ws.id, 'same content'));
    const b = await t.evidence.ingest(baseInput(ws.id, 'same content'));
    expect(b.id).toBe(a.id);

    const count = await t.dataSource
      .getRepository(SourceEvidence)
      .count({ where: { workspaceId: ws.id } });
    expect(count).toBe(1);
  });

  it('is concurrency-safe: parallel identical ingests converge to one row', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        t.evidence.ingest(baseInput(ws.id, 'racy content')),
      ),
    );
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const count = await t.dataSource
      .getRepository(SourceEvidence)
      .count({ where: { workspaceId: ws.id } });
    expect(count).toBe(1);
  });

  it('isolates identical content across workspaces', async () => {
    const wsA = await t.workspaces.getOrCreate(uniqueSlug('a'));
    const wsB = await t.workspaces.getOrCreate(uniqueSlug('b'));
    const a = await t.evidence.ingest(baseInput(wsA.id, 'shared text'));
    const b = await t.evidence.ingest(baseInput(wsB.id, 'shared text'));
    expect(a.id).not.toBe(b.id);

    // Evidence from workspace A is not reachable scoped to workspace B.
    expect(await t.evidence.findByIdInWorkspace(wsB.id, a.id)).toBeNull();
    expect(await t.evidence.findByIdInWorkspace(wsA.id, a.id)).not.toBeNull();
  });

  it('rejects empty content and non-http source URLs', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await expect(t.evidence.ingest(baseInput(ws.id, '   '))).rejects.toThrow();
    await expect(
      t.evidence.ingest({
        ...baseInput(ws.id, 'x'),
        sourceUrl: 'ftp://nope',
      }),
    ).rejects.toThrow();
  });
});
