import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup, LookupAddress } from 'node:dns';
import {
  isConnectAllowed,
  SsrfBlockedError,
  validateFetchUrl,
} from './ssrf';

export type FetchPolicy = {
  maxRedirects: number;
  maxBytes: number;
  timeoutMs: number;
  /** Tests only: permit loopback so the fetcher can hit a local server. */
  allowLoopback: boolean;
};

export type FetchResult = {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  fetchedAt: Date;
};

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

const USER_AGENT = 'SytadelGrowthOS/0.1 (+research-fetch)';

/**
 * Read-only HTTP(S) fetcher hardened against SSRF:
 *  - every destination IP is validated at connect time via a custom DNS lookup
 *    that only returns allowed addresses, so the socket connects to exactly the
 *    address we validated (closes the DNS-rebinding TOCTOU window);
 *  - redirects are followed manually and each hop's URL is re-validated, capped
 *    at `maxRedirects`;
 *  - response size and total time are bounded.
 * It never executes anything; the body is returned verbatim as untrusted data.
 */
export class HttpFetcher {
  constructor(private readonly policy: FetchPolicy) {}

  async fetch(rawUrl: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.policy.timeoutMs);
    const startedAt = new Date();
    try {
      let current = validateFetchUrl(rawUrl, this.policy.allowLoopback);
      for (let hop = 0; hop <= this.policy.maxRedirects; hop++) {
        const res = await this.requestOnce(current, controller.signal);
        if (isRedirect(res.status) && res.location !== undefined) {
          if (hop === this.policy.maxRedirects) {
            throw new FetchError('Too many redirects');
          }
          const next = resolveLocation(current, res.location);
          current = validateFetchUrl(next.href, this.policy.allowLoopback);
          continue;
        }
        return {
          finalUrl: current.href,
          status: res.status,
          contentType: res.contentType,
          body: res.body,
          bytes: res.bytes,
          fetchedAt: startedAt,
        };
      }
      throw new FetchError('Too many redirects');
    } finally {
      clearTimeout(timer);
    }
  }

  private requestOnce(
    url: URL,
    signal: AbortSignal,
  ): Promise<{
    status: number;
    location?: string;
    contentType: string;
    body: string;
    bytes: number;
  }> {
    const lib = url.protocol === 'https:' ? https : http;
    const allowLoopback = this.policy.allowLoopback;
    const maxBytes = this.policy.maxBytes;

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        fn();
      };
      const fail = (err: unknown): void => {
        if (err instanceof SsrfBlockedError || err instanceof FetchError) {
          settle(() => reject(err));
        } else if (signal.aborted) {
          settle(() => reject(new FetchError('Fetch timed out')));
        } else {
          const name = err instanceof Error ? err.name : 'unknown';
          settle(() => reject(new FetchError(`Fetch failed: ${name}`)));
        }
      };

      const req = lib.request(
        url,
        {
          method: 'GET',
          signal,
          headers: { 'user-agent': USER_AGENT, accept: '*/*' },
          lookup: makePinnedLookup(allowLoopback),
        },
        (res) => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          const contentType = (res.headers['content-type'] ?? '').toString();

          if (isRedirect(status) && location) {
            res.resume(); // drain, we won't read a redirect body
            settle(() =>
              resolve({ status, location, contentType, body: '', bytes: 0 }),
            );
            return;
          }

          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > maxBytes) {
              // Stop reading without an error arg (avoids an unhandled 'error')
              // and settle as a size-limit failure exactly once.
              res.destroy();
              settle(() =>
                reject(new FetchError('Response exceeded size limit')),
              );
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () =>
            settle(() =>
              resolve({
                status,
                contentType,
                body: Buffer.concat(chunks).toString('utf8'),
                bytes,
              }),
            ),
          );
          res.on('error', fail);
        },
      );

      req.on('error', fail);
      req.end();
    });
  }
}

/** A DNS lookup that only resolves to allowed (validated) addresses. */
function makePinnedLookup(allowLoopback: boolean): typeof dnsLookup {
  const fn = (
    hostname: string,
    options: unknown,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ): void => {
    dnsLookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        callback(err, '', undefined);
        return;
      }
      const allowed = addresses.filter((a) =>
        isConnectAllowed(a.address, allowLoopback),
      );
      if (allowed.length === 0) {
        callback(
          new SsrfBlockedError(`No allowed IP for host ${hostname}`),
          '',
          undefined,
        );
        return;
      }
      const wantsAll =
        typeof options === 'object' && options !== null && 'all' in options
          ? Boolean((options as { all?: boolean }).all)
          : false;
      if (wantsAll) {
        callback(null, allowed);
      } else {
        const first = allowed[0]!;
        callback(null, first.address, first.family);
      }
    });
  };
  return fn as unknown as typeof dnsLookup;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveLocation(current: URL, location: string): URL {
  try {
    return new URL(location, current);
  } catch {
    throw new FetchError('Invalid redirect location');
  }
}
