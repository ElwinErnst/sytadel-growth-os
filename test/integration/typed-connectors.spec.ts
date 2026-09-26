import http from 'node:http';
import { AddressInfo } from 'node:net';
import { SourceKind } from '../../src/common/enums';
import { HttpFetcher } from '../../src/modules/fetch/http-fetcher';
import { ConnectorError } from '../../src/modules/research/connectors/connector';
import { HackerNewsConnector } from '../../src/modules/research/connectors/hacker-news.connector';
import { GitHubReleasesConnector } from '../../src/modules/research/connectors/github-releases.connector';
import { ResearchSource } from '../../src/modules/research/entities/research-source.entity';

const loopbackFetcher = new HttpFetcher({
  maxRedirects: 2,
  maxBytes: 1_000_000,
  timeoutMs: 2_000,
  allowLoopback: true,
});

const HN = {
  hits: [
    {
      title: 'Why API keys are dangerous for agents',
      url: 'https://ex.com/a',
      author: 'x',
      points: 120,
      num_comments: 45,
      created_at: '2026-09-20T10:00:00Z',
      objectID: '111',
    },
    {
      title: 'Agent identity vs service accounts',
      url: null,
      points: 80,
      num_comments: 10,
      created_at: '2026-09-19T10:00:00Z',
      objectID: '222',
      story_text: 'discussion text',
    },
  ],
};

const GH = [
  {
    tag_name: 'v1.2.0',
    name: 'Big release',
    published_at: '2026-09-15T00:00:00Z',
    draft: false,
    prerelease: false,
    body: 'Added audit chaining',
  },
  {
    tag_name: 'v1.3.0-rc1',
    name: 'RC',
    published_at: '2026-09-20T00:00:00Z',
    draft: false,
    prerelease: true,
    body: 'Release candidate',
  },
  { tag_name: 'draft-tag', name: 'Hidden', draft: true, body: 'hidden' },
];

function source(url: string, kind: SourceKind): ResearchSource {
  return { url, label: `src ${url}`, kind } as ResearchSource;
}

describe('Typed connectors (integration, local server)', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const json = (body: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      switch (req.url) {
        case '/hn':
          return json(HN);
        case '/hn-empty':
          return json({ hits: [] });
        case '/gh':
          return json(GH);
        case '/gh-empty':
          return json([]);
        case '/notjson':
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end('this is not json');
        case '/wrongshape':
          return json({ nope: true });
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
  });

  describe('HackerNewsConnector', () => {
    const c = new HackerNewsConnector(loopbackFetcher);

    it('digests stories into one item', async () => {
      const [item] = await c.collect(source(`${base}/hn`, SourceKind.HACKER_NEWS));
      expect(item!.content).toContain('Why API keys are dangerous for agents');
      expect(item!.content).toContain('120 pts');
      // Story with null url falls back to the HN item link.
      expect(item!.content).toContain('news.ycombinator.com/item?id=222');
      expect(item!.sourceUrl).toBe(`${base}/hn`);
    });

    it('errors on empty results', async () => {
      await expect(
        c.collect(source(`${base}/hn-empty`, SourceKind.HACKER_NEWS)),
      ).rejects.toBeInstanceOf(ConnectorError);
    });
  });

  describe('GitHubReleasesConnector', () => {
    const c = new GitHubReleasesConnector(loopbackFetcher);

    it('digests releases and filters drafts', async () => {
      const [item] = await c.collect(
        source(`${base}/gh`, SourceKind.GITHUB_RELEASES),
      );
      expect(item!.content).toContain('v1.2.0');
      expect(item!.content).toContain('v1.3.0-rc1');
      expect(item!.content).toContain('[prerelease]');
      expect(item!.content).not.toContain('draft-tag'); // draft filtered out
    });

    it('errors when there are no published releases', async () => {
      await expect(
        c.collect(source(`${base}/gh-empty`, SourceKind.GITHUB_RELEASES)),
      ).rejects.toBeInstanceOf(ConnectorError);
    });
  });

  describe('malformed responses', () => {
    it('rejects non-JSON bodies', async () => {
      const c = new HackerNewsConnector(loopbackFetcher);
      await expect(
        c.collect(source(`${base}/notjson`, SourceKind.HACKER_NEWS)),
      ).rejects.toBeInstanceOf(ConnectorError);
    });

    it('rejects unexpected JSON shapes', async () => {
      const c = new GitHubReleasesConnector(loopbackFetcher);
      await expect(
        c.collect(source(`${base}/wrongshape`, SourceKind.GITHUB_RELEASES)),
      ).rejects.toBeInstanceOf(ConnectorError);
    });
  });
});
