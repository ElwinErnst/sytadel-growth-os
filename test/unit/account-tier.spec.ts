import { tierFromScore } from '../../src/modules/accounts/account.service';
import { AccountFitTier } from '../../src/common/enums';

describe('tierFromScore', () => {
  it('maps scores to tiers at the 0.7 / 0.4 thresholds', () => {
    expect(tierFromScore(1)).toBe(AccountFitTier.STRONG);
    expect(tierFromScore(0.7)).toBe(AccountFitTier.STRONG);
    expect(tierFromScore(0.69)).toBe(AccountFitTier.MEDIUM);
    expect(tierFromScore(0.4)).toBe(AccountFitTier.MEDIUM);
    expect(tierFromScore(0.39)).toBe(AccountFitTier.WEAK);
    expect(tierFromScore(0)).toBe(AccountFitTier.WEAK);
  });
});
