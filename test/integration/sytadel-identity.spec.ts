import http from 'node:http';
import { AddressInfo } from 'node:net';
import { AppConfig } from '../../src/config/configuration';
import {
  SytadelAuthError,
  SytadelIdentityService,
} from '../../src/modules/identity/sytadel-identity.service';

type SytadelCfg = AppConfig['sytadel'];

const validToken = {
  accessToken: 'jwt.header.payload',
  accessTokenExpiresIn: 3600,
  tokenType: 'Bearer',
  tenant: { id: 't-1', slug: 'acme', name: 'Acme' },
  clientApp: { id: 'app-1' },
  serviceAccount: {
    id: 'sa-1',
    tenantId: 't-1',
    clientAppId: 'app-1',
    environmentId: null,
    scopes: ['payments:read'],
  },
};

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

describe('SytadelIdentityService (integration, fixture auth server)', () => {
  let server: http.Server;
  let base: string;
  let tokenRequests = 0;
  let lastBody: Record<string, unknown> = {};

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const body = await readBody(req);
      const json = (code: number, obj: unknown) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (req.url === '/api/integrations/service-account-token') {
        tokenRequests++;
        lastBody = JSON.parse(body || '{}');
        if (lastBody.clientSecret === 'good-secret') return json(200, validToken);
        return json(401, { message: 'Invalid service account credentials' });
      }
      if (req.url === '/badapi/integrations/service-account-token') {
        return json(200, { nope: true }); // 200 but wrong shape
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  beforeEach(() => {
    tokenRequests = 0;
  });

  function cfg(overrides: Partial<SytadelCfg> = {}): SytadelCfg {
    return {
      enabled: true,
      authUrl: `${base}/api`,
      tenantSlug: 'acme',
      clientAppId: 'app-1',
      serviceAccountId: 'sa-1',
      clientSecret: 'good-secret',
      timeoutMs: 2000,
      ...overrides,
    };
  }

  it('returns null and makes no request when disabled', async () => {
    const svc = new SytadelIdentityService(cfg({ enabled: false }));
    expect(await svc.getPrincipal()).toBeNull();
    expect(tokenRequests).toBe(0);
  });

  it('authenticates and returns the principal from the token response', async () => {
    const svc = new SytadelIdentityService(cfg());
    const principal = await svc.getPrincipal();
    expect(principal).toEqual({
      tenantId: 't-1',
      tenantSlug: 'acme',
      serviceAccountId: 'sa-1',
      clientAppId: 'app-1',
      scopes: ['payments:read'],
    });
    // Sent the expected credential body.
    expect(lastBody.serviceAccountId).toBe('sa-1');
    expect(lastBody.tenantSlug).toBe('acme');
  });

  it('caches the principal across calls (single HTTP request)', async () => {
    const svc = new SytadelIdentityService(cfg());
    await svc.getPrincipal();
    await svc.getPrincipal();
    expect(tokenRequests).toBe(1);
  });

  it('surfaces a rejected credential as SytadelAuthError (no null fallback)', async () => {
    const svc = new SytadelIdentityService(cfg({ clientSecret: 'wrong' }));
    await expect(svc.getPrincipal()).rejects.toBeInstanceOf(SytadelAuthError);
  });

  it('rejects an unexpected response shape', async () => {
    const svc = new SytadelIdentityService(cfg({ authUrl: `${base}/badapi` }));
    await expect(svc.getPrincipal()).rejects.toBeInstanceOf(SytadelAuthError);
  });

  it('errors when enabled but not fully configured', async () => {
    const svc = new SytadelIdentityService(cfg({ clientSecret: null }));
    await expect(svc.getPrincipal()).rejects.toBeInstanceOf(SytadelAuthError);
  });
});
