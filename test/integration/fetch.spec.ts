import { EvidenceProvenance } from '../../src/common/enums';
import { FetchService } from '../../src/modules/fetch/fetch.service';
import {
  FetchError,
  FetchResult,
  HttpFetcher,
} from '../../src/modules/fetch/http-fetcher';
import {
  ScopeDeniedError,
  SytadelIdentityService,
  SytadelPrincipal,
} from '../../src/modules/identity/sytadel-identity.service';
import { createTestApp, stubIdentity, TestApp, uniqueSlug } from './harness';

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

  /** FetchService with a given fetcher; identity disabled unless overridden. */
  function svc(
    fetcher: HttpFetcher,
    identity: SytadelIdentityService = stubIdentity(null),
  ): FetchService {
    return new FetchService(fetcher, t.evidence, identity);
  }

  it('stores a successful fetch as FETCHED evidence with the final url + fetch time', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const ev = await svc(
      stubFetcher({
        finalUrl: 'https://example.com/final',
        body: 'real content',
        fetchedAt: new Date('2026-09-24T10:00:00Z'),
      }),
    ).fetchToEvidence(ws.id, 'https://example.com/start');
    expect(ev.provenance).toBe(EvidenceProvenance.FETCHED);
    expect(ev.sourceUrl).toBe('https://example.com/final');
    expect(ev.content).toBe('real content');
    expect(ev.retrievedAt.toISOString()).toBe('2026-09-24T10:00:00.000Z');
  });

  it('deduplicates identical fetched content within a workspace', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const s = svc(stubFetcher({ body: 'same' }));
    const a = await s.fetchToEvidence(ws.id, 'https://example.com/a');
    const b = await s.fetchToEvidence(ws.id, 'https://example.com/a');
    expect(b.id).toBe(a.id);
  });

  it('rejects non-success responses', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await expect(
      svc(stubFetcher({ status: 404 })).fetchToEvidence(
        ws.id,
        'https://example.com/missing',
      ),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('rejects an empty body', async () => {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    await expect(
      svc(stubFetcher({ body: '   ' })).fetchToEvidence(
        ws.id,
        'https://example.com/blank',
      ),
    ).rejects.toBeInstanceOf(FetchError);
  });

  describe('scope enforcement (Sytadel auth on)', () => {
    const withScopes = (scopes: string[]): SytadelPrincipal => ({
      tenantId: 't-1',
      tenantSlug: 'acme',
      serviceAccountId: 'sa-1',
      clientAppId: 'app-1',
      scopes,
    });

    it('allows the fetch when the principal holds research:fetch', async () => {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      const ev = await svc(
        stubFetcher({ body: 'scoped content' }),
        stubIdentity(withScopes(['research:fetch'])),
      ).fetchToEvidence(ws.id, 'https://example.com/ok');
      expect(ev.provenance).toBe(EvidenceProvenance.FETCHED);
    });

    it('denies the fetch when the principal lacks research:fetch', async () => {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      await expect(
        svc(
          stubFetcher({ body: 'nope' }),
          stubIdentity(withScopes(['research:read'])),
        ).fetchToEvidence(ws.id, 'https://example.com/denied'),
      ).rejects.toBeInstanceOf(ScopeDeniedError);
    });
  });
});
