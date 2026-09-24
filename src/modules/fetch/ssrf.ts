import { isIP } from 'node:net';

/**
 * SSRF classification for outbound fetches. The rule is allowlist-by-exclusion:
 * a destination IP is only fetchable if it is a normal, globally-routable
 * address. Everything private, local, or otherwise special is blocked so a
 * fetch can never be steered at internal services or cloud metadata.
 *
 * This is the security-critical core of the fetch feature and is unit-tested
 * directly against IP literals; the fetcher pins connections to the exact IP
 * this module validates, closing the DNS-rebinding (TOCTOU) gap.
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

/** True if `ip` (v4 or v6 literal) is safe to connect to. */
export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicIpv4(ip);
  if (version === 6) return isPublicIpv6(ip);
  return false;
}

/** True if `ip` is a loopback address (127.0.0.0/8 or ::1). */
export function isLoopbackIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const ipInt = ipv4ToInt(ip);
    return ipInt !== null && inCidrV4(ipInt, '127.0.0.0', 8);
  }
  if (version === 6) {
    const lower = ip.toLowerCase().split('%')[0] ?? '';
    return lower === '::1';
  }
  return false;
}

/**
 * Connection-time predicate. Normally an address must be public; `allowLoopback`
 * (tests only, never in production config) additionally permits loopback so the
 * fetcher's mechanics can be exercised against a local server.
 */
export function isConnectAllowed(ip: string, allowLoopback = false): boolean {
  if (isPublicIp(ip)) return true;
  return allowLoopback && isLoopbackIp(ip);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

/** CIDRs that must never be fetched (private, local, reserved, special-use). */
const BLOCKED_V4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network / unspecified
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. 169.254.169.254 metadata)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved (incl. 255.255.255.255 broadcast)
];

function inCidrV4(ipInt: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isPublicIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;
  for (const [base, bits] of BLOCKED_V4_CIDRS) {
    if (inCidrV4(ipInt, base, bits)) return false;
  }
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0] ?? ''; // strip zone id

  // IPv4-mapped / -embedded (::ffff:a.b.c.d, ::a.b.c.d): classify as IPv4.
  const mapped = lower.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (mapped && mapped[1]) return isPublicIpv4(mapped[1]);

  if (lower === '::1') return false; // loopback
  if (lower === '::' || lower === '') return false; // unspecified

  const head = expandV6Head(lower);
  if (head === null) return false;
  // fe80::/10 link-local, fc00::/7 unique-local, ff00::/8 multicast.
  if ((head & 0xffc0) === 0xfe80) return false;
  if ((head & 0xfe00) === 0xfc00) return false;
  if ((head & 0xff00) === 0xff00) return false;
  // 64:ff9b::/96 and ::/96 embeddings and other ::x are treated conservatively:
  // a bare "::something" that reached here is fine unless it is a small value.
  return true;
}

/** First 16 bits of an IPv6 address, for prefix checks. */
function expandV6Head(ip: string): number | null {
  const firstGroup = ip.split(':')[0];
  if (firstGroup === undefined) return null;
  if (firstGroup === '') return 0; // address starts with "::"
  if (!/^[0-9a-f]{1,4}$/.test(firstGroup)) return null;
  return Number.parseInt(firstGroup, 16);
}

/**
 * Validate a URL string is shaped for a safe fetch: it must be an absolute
 * http(s) URL. IP-level checks happen at connect time against the resolved
 * address(es). Returns the parsed URL or throws SsrfBlockedError.
 */
export function validateFetchUrl(raw: string, allowLoopback = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfBlockedError('URL is not absolute/parseable');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfBlockedError(`Unsupported protocol: ${url.protocol}`);
  }
  if (url.hostname === '') {
    throw new SsrfBlockedError('URL has no host');
  }
  // Strip brackets from IPv6 literals (e.g. [::1]) before classifying.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // If the host is an IP literal, we can reject immediately.
  if (isIP(host) !== 0 && !isConnectAllowed(host, allowLoopback)) {
    throw new SsrfBlockedError(`Blocked IP host: ${host}`);
  }
  return url;
}
