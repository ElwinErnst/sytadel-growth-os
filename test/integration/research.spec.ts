import http from 'node:http';
import { AddressInfo } from 'node:net';
import { EvidenceProvenance, SourceKind } from '../../src/common/enums';
import { SsrfBlockedError } from '../../src/modules/fetch/ssrf';
import { HttpFetcher } from '../../src/modules/fetch/http-fetcher';
import { ResearchSource } from '../../src/modules/research/entities/research-source.entity';
import { createTestApp, TestApp, uniqueSlug } from './harness';

const loopbackFetcher = new HttpFetcher({
  maxRedirects: 3,
  maxBytes: 1_000_000,
  timeoutMs: 2_000,
  allowLoopback: true,
});

describe('Research connectors + run (integration)', () => {
  let t: TestApp;
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    t = await createTestApp(undefined, loopbackFetcher);
    server = http.createServer((req, res) => {
      switch (req.url) {
        case '/page':
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end(
            '<html><body><h1>Pricing</h1><p>Plans start at $99/mo</p><script>track()</script></body></html>',
          );
          return;
        case '/notfound':
          res.writeHead(404);
          res.end('nope');
          return;
        default:
          res.writeHead(404);
          res.end('nope');
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await t.close();
  });

  /** Insert a source directly (addSource blocks loopback URLs by design). */
  async function addLoopbackSource(workspaceId: string, path: string) {
    const repo = t.dataSource.getRepository(ResearchSource);
    return repo.save(
      repo.create({
        workspaceId,
        url: `${base}${path}`,
        label: `local ${path}`,
        kind: SourceKind.WEB_PAGE,
        enabled: true,
      }),
    );
  }

  it('addSource validates + dedups, and rejects blocked URLs', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const a = await t.research.addSource(ws.id, 'https://example.com/a', 'A');
    const b = await t.research.addSource(ws.id, 'https://example.com/a');
    expect(b.id).toBe(a.id); // dedup by (workspace, url)

    await expect(
      t.research.addSource(ws.id, 'http://169.254.169.254/latest'),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('runs a web_page source into normalized fetched evidence', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await addLoopbackSource(ws.id, '/page');

    const result = await t.research.run(ws.id);
    expect(result.stored).toBe(1);
    expect(result.failed).toBe(0);

    const evidenceId = result.outcomes[0]!.evidenceIds[0]!;
    const ev = await t.evidence.findByIdInWorkspace(ws.id, evidenceId);
    expect(ev).not.toBeNull();
    expect(ev!.provenance).toBe(EvidenceProvenance.FETCHED);
    expect(ev!.content).toContain('Pricing');
    expect(ev!.content).toContain('Plans start at $99/mo');
    expect(ev!.content).not.toContain('<h1>');
    expect(ev!.content).not.toContain('track()'); // script stripped
  });

  it('is resilient: one failing source does not abort the batch', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await addLoopbackSource(ws.id, '/page');
    await addLoopbackSource(ws.id, '/notfound');

    const result = await t.research.run(ws.id);
    expect(result.stored).toBe(1);
    expect(result.failed).toBe(1);
    const failed = result.outcomes.find((o) => !o.ok);
    expect(failed?.error).toContain('ConnectorError');
  });

  it('deduplicates identical content across repeated runs', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await addLoopbackSource(ws.id, '/page');

    const first = await t.research.run(ws.id);
    const second = await t.research.run(ws.id);
    expect(first.outcomes[0]!.evidenceIds[0]).toBe(
      second.outcomes[0]!.evidenceIds[0],
    );
    expect(await t.evidence.countByWorkspace(ws.id)).toBe(1);
  });
});
