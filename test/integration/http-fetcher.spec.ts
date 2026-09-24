import http from 'node:http';
import { AddressInfo } from 'node:net';
import { HttpFetcher, FetchError, FetchPolicy } from '../../src/modules/fetch/http-fetcher';
import { SsrfBlockedError } from '../../src/modules/fetch/ssrf';

const basePolicy: FetchPolicy = {
  maxRedirects: 3,
  maxBytes: 1_000_000,
  timeoutMs: 2_000,
  allowLoopback: true, // tests only — lets us hit the local server
};

describe('HttpFetcher (integration, local server)', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      switch (req.url) {
        case '/ok':
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end('hello world');
          return;
        case '/big':
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end('x'.repeat(50_000));
          return;
        case '/redirect':
          res.writeHead(302, { location: '/ok' });
          res.end();
          return;
        case '/redirect-blocked':
          res.writeHead(302, { location: 'http://169.254.169.254/latest' });
          res.end();
          return;
        case '/loop':
          res.writeHead(302, { location: '/loop' });
          res.end();
          return;
        case '/slow':
          setTimeout(() => {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('late');
          }, 500);
          return;
        default:
          res.writeHead(404);
          res.end('nope');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('fetches a simple 200 response', async () => {
    const res = await new HttpFetcher(basePolicy).fetch(`${base}/ok`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('hello world');
    expect(res.contentType).toContain('text/plain');
    expect(res.finalUrl).toBe(`${base}/ok`);
  });

  it('follows a redirect to a same-host allowed path', async () => {
    const res = await new HttpFetcher(basePolicy).fetch(`${base}/redirect`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('hello world');
    expect(res.finalUrl).toBe(`${base}/ok`);
  });

  it('rejects a redirect that points at a blocked IP', async () => {
    await expect(
      new HttpFetcher(basePolicy).fetch(`${base}/redirect-blocked`),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('enforces the redirect cap on a redirect loop', async () => {
    await expect(
      new HttpFetcher({ ...basePolicy, maxRedirects: 2 }).fetch(`${base}/loop`),
    ).rejects.toThrow(/Too many redirects/);
  });

  it('enforces the size cap', async () => {
    await expect(
      new HttpFetcher({ ...basePolicy, maxBytes: 100 }).fetch(`${base}/big`),
    ).rejects.toThrow(/size limit/);
  });

  it('enforces the timeout', async () => {
    await expect(
      new HttpFetcher({ ...basePolicy, timeoutMs: 80 }).fetch(`${base}/slow`),
    ).rejects.toThrow(FetchError);
  });

  it('blocks a direct request to a non-loopback internal IP even with allowLoopback', async () => {
    await expect(
      new HttpFetcher(basePolicy).fetch('http://169.254.169.254/latest'),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
