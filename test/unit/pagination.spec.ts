import { toPageParams } from '../../src/common/pagination';

describe('toPageParams', () => {
  it('applies defaults when nothing is provided', () => {
    expect(toPageParams()).toEqual({ limit: 20, offset: 0 });
  });

  it('parses valid inputs', () => {
    expect(toPageParams('10', '5')).toEqual({ limit: 10, offset: 5 });
  });

  it('clamps limit to the [1,100] range', () => {
    expect(toPageParams('0').limit).toBe(1);
    expect(toPageParams('9999').limit).toBe(100);
  });

  it('never returns a negative offset', () => {
    expect(toPageParams(undefined, '-5').offset).toBe(0);
  });

  it('falls back to defaults on non-numeric input', () => {
    expect(toPageParams('abc', 'xyz')).toEqual({ limit: 20, offset: 0 });
  });
});
