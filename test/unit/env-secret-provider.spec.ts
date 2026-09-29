import { EnvSecretProvider } from '../../src/modules/secrets/env-secret-provider';

describe('EnvSecretProvider', () => {
  const provider = new EnvSecretProvider({
    PRESENT: 'value',
    PADDED: '  spaced  ',
    EMPTY: '',
    BLANK: '   ',
  });

  it('returns a present value (trimmed)', () => {
    expect(provider.get('PRESENT')).toBe('value');
    expect(provider.get('PADDED')).toBe('spaced');
  });

  it('treats unset, empty, and blank as null', () => {
    expect(provider.get('MISSING')).toBeNull();
    expect(provider.get('EMPTY')).toBeNull();
    expect(provider.get('BLANK')).toBeNull();
  });

  it('require returns the value or throws with the name (not value)', () => {
    expect(provider.require('PRESENT')).toBe('value');
    expect(() => provider.require('MISSING')).toThrow('MISSING');
    // The thrown message must not leak a value (there is none here, but the
    // contract is name-only).
    expect(() => provider.require('MISSING')).toThrow(
      'Missing required secret "MISSING"',
    );
  });

  it('defaults to process.env when no snapshot is given', () => {
    const key = '__GROWTH_TEST_SECRET__';
    process.env[key] = 'from-env';
    try {
      expect(new EnvSecretProvider().get(key)).toBe('from-env');
    } finally {
      delete process.env[key];
    }
  });
});
