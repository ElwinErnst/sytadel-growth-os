import {
  isConnectAllowed,
  isLoopbackIp,
  isPublicIp,
  SsrfBlockedError,
  validateFetchUrl,
} from '../../src/modules/fetch/ssrf';

describe('isPublicIp', () => {
  const publicIps = [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34', // example.com
    '2606:4700:4700::1111', // cloudflare v6
  ];
  const blockedIps = [
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // cloud metadata
    '169.254.0.1', // link-local
    '100.64.0.1', // CGNAT
    '224.0.0.1', // multicast
    '255.255.255.255', // broadcast
    '::1', // v6 loopback
    '::', // v6 unspecified
    'fe80::1', // v6 link-local
    'fc00::1', // v6 unique-local
    'fd12:3456::1', // v6 ULA
    'ff02::1', // v6 multicast
    '::ffff:10.0.0.1', // v4-mapped private
    '::ffff:127.0.0.1', // v4-mapped loopback
  ];

  it.each(publicIps)('allows public IP %s', (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each(blockedIps)('blocks non-public IP %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it('rejects garbage', () => {
    expect(isPublicIp('not-an-ip')).toBe(false);
    expect(isPublicIp('999.1.1.1')).toBe(false);
  });
});

describe('isLoopbackIp / isConnectAllowed', () => {
  it('detects loopback', () => {
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(isLoopbackIp('127.5.5.5')).toBe(true);
    expect(isLoopbackIp('::1')).toBe(true);
    expect(isLoopbackIp('8.8.8.8')).toBe(false);
  });

  it('only allows loopback when explicitly permitted', () => {
    expect(isConnectAllowed('127.0.0.1')).toBe(false);
    expect(isConnectAllowed('127.0.0.1', true)).toBe(true);
    // A blocked-but-not-loopback address stays blocked even with the flag.
    expect(isConnectAllowed('169.254.169.254', true)).toBe(false);
    expect(isConnectAllowed('8.8.8.8')).toBe(true);
  });
});

describe('validateFetchUrl', () => {
  it('accepts absolute http(s) URLs with a public host', () => {
    expect(validateFetchUrl('https://example.com/path').hostname).toBe(
      'example.com',
    );
  });

  it('rejects non-http protocols', () => {
    expect(() => validateFetchUrl('ftp://example.com')).toThrow(
      SsrfBlockedError,
    );
    expect(() => validateFetchUrl('file:///etc/passwd')).toThrow(
      SsrfBlockedError,
    );
  });

  it('rejects blocked IP literals (v4 and bracketed v6)', () => {
    expect(() => validateFetchUrl('http://169.254.169.254/latest')).toThrow(
      SsrfBlockedError,
    );
    expect(() => validateFetchUrl('http://10.0.0.5')).toThrow(SsrfBlockedError);
    expect(() => validateFetchUrl('http://[::1]:8080')).toThrow(
      SsrfBlockedError,
    );
  });

  it('rejects relative/garbage URLs', () => {
    expect(() => validateFetchUrl('/just/a/path')).toThrow(SsrfBlockedError);
    expect(() => validateFetchUrl('nonsense')).toThrow(SsrfBlockedError);
  });

  it('permits loopback literal only when allowLoopback is set', () => {
    expect(() => validateFetchUrl('http://127.0.0.1:3000')).toThrow(
      SsrfBlockedError,
    );
    expect(validateFetchUrl('http://127.0.0.1:3000', true).hostname).toBe(
      '127.0.0.1',
    );
  });
});
