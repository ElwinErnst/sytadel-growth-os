import { EvidenceProvenance } from '../../src/common/enums';
import { FetchService } from '../../src/modules/fetch/fetch.service';
import {
  FetchError,
  FetchResult,
  HttpFetcher,
} from '../../src/modules/fetch/http-fetcher';
import { createTestApp, TestApp, uniqueSlug } from './harness';

/** Build a stub fetcher returning a fixed result (no network). */
function stubFetcher(result: Partial<FetchResult>): HttpFetcher {
  const full: FetchResult = {
    finalUrl: 'https://example.com/page',
    status: 200,
    contentType: 'text/html',
    body: 'fetched body',
    bytes: 12,
    fetchedAt: new Date('2026-09-24T00:00:00Z'),
    ...result,
  };
  return { fetch: async () => full } as unknown as HttpFetcher;
}

describe('FetchService → evidence (integration)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('stores a successful fetch as FETCHED evidence with the final url + fetch time', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const svc = new FetchService(
      stubFetcher({
        finalUrl: 'https://example.com/final',
        body: 'real content',
        fetchedAt: new Date('2026-09-24T10:00:00Z'),
      }),
      t.evidence,
    );
    const ev = await svc.fetchToEvidence(ws.id, 'https://example.com/start');
    expect(ev.provenance).toBe(EvidenceProvenance.FETCHED);
    expect(ev.sourceUrl).toBe('https://example.com/final');
    expect(ev.content).toBe('real content');
    expect(ev.retrievedAt.toISOString()).toBe('2026-09-24T10:00:00.000Z');
  });

  it('deduplicates identical fetched content within a workspace', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const svc = new FetchService(stubFetcher({ body: 'same' }), t.evidence);
    const a = await svc.fetchToEvidence(ws.id, 'https://example.com/a');
    const b = await svc.fetchToEvidence(ws.id, 'https://example.com/a');
    expect(b.id).toBe(a.id);
  });

  it('rejects non-success responses', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const svc = new FetchService(stubFetcher({ status: 404 }), t.evidence);
    await expect(
      svc.fetchToEvidence(ws.id, 'https://example.com/missing'),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('rejects an empty body', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const svc = new FetchService(stubFetcher({ body: '   ' }), t.evidence);
    await expect(
      svc.fetchToEvidence(ws.id, 'https://example.com/blank'),
    ).rejects.toBeInstanceOf(FetchError);
  });
});
