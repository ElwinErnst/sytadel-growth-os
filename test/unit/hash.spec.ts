import { fingerprint, sha256 } from '../../src/common/util/hash';

describe('sha256', () => {
  it('is stable and 64 hex chars', () => {
    const a = sha256('hello');
    expect(a).toBe(sha256('hello'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('fingerprint', () => {
  it('collapses cosmetic differences to the same value', () => {
    expect(fingerprint('AI agents need identity.')).toBe(
      fingerprint('  ai   agents need identity  '),
    );
  });

  it('distinguishes genuinely different statements', () => {
    expect(fingerprint('Auth0 raised prices')).not.toBe(
      fingerprint('Clerk raised prices'),
    );
  });
});
