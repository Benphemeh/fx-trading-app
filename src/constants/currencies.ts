export const CURRENCY_DECIMALS: Record<string, number> = {
  NGN: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

export function getMinorUnitMultiplier(currency: string): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  return Math.pow(10, decimals);
}

export function toMinorUnits(amount: number, currency: string): number {
  const mul = getMinorUnitMultiplier(currency);
  return Math.round(amount * mul);
}

export function fromMinorUnits(amountMinor: number, currency: string): number {
  const mul = getMinorUnitMultiplier(currency);
  return amountMinor / mul;
}
