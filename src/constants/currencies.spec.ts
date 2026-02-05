import {
  toMinorUnits,
  fromMinorUnits,
  getMinorUnitMultiplier,
} from './currencies';

describe('Currencies', () => {
  describe('getMinorUnitMultiplier', () => {
    it('returns 100 for NGN, USD, EUR', () => {
      expect(getMinorUnitMultiplier('NGN')).toBe(100);
      expect(getMinorUnitMultiplier('USD')).toBe(100);
      expect(getMinorUnitMultiplier('EUR')).toBe(100);
    });
  });

  describe('toMinorUnits', () => {
    it('converts major to minor units', () => {
      expect(toMinorUnits(10, 'USD')).toBe(1000);
      expect(toMinorUnits(1.5, 'NGN')).toBe(150);
      expect(toMinorUnits(0.01, 'EUR')).toBe(1);
    });

    it('rounds to nearest integer', () => {
      expect(toMinorUnits(1.234, 'USD')).toBe(123);
      expect(toMinorUnits(1.235, 'USD')).toBe(124);
    });
  });

  describe('fromMinorUnits', () => {
    it('converts minor to major units', () => {
      expect(fromMinorUnits(1000, 'USD')).toBe(10);
      expect(fromMinorUnits(150, 'NGN')).toBe(1.5);
      expect(fromMinorUnits(1, 'EUR')).toBe(0.01);
    });
  });

  describe('round-trip', () => {
    it('preserves value for whole amounts', () => {
      const amount = 1000;
      const minor = toMinorUnits(amount, 'NGN');
      expect(fromMinorUnits(minor, 'NGN')).toBe(amount);
    });
  });
});
