import { Prisma } from '@prisma/client';

export type DecimalValue = Prisma.Decimal | number | string;

/**
 * Ensures any monetary input is converted into a safe Prisma.Decimal instance.
 */
export function toDecimal(value: DecimalValue): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  if (typeof value === 'number') {
    return new Prisma.Decimal(value.toFixed(2));
  }
  return new Prisma.Decimal(value);
}

/**
 * Adds two monetary amounts using decimal-safe arithmetic.
 */
export function addMoney(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
  return toDecimal(a).add(toDecimal(b));
}

/**
 * Subtracts monetary amount b from a using decimal-safe arithmetic.
 */
export function subtractMoney(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
  return toDecimal(a).sub(toDecimal(b));
}

/**
 * Multiplies a monetary amount by a multiplier (e.g. quantity or rate).
 */
export function multiplyMoney(a: DecimalValue, multiplier: number | string | Prisma.Decimal): Prisma.Decimal {
  return toDecimal(a).mul(toDecimal(multiplier));
}

/**
 * Divides a monetary amount by a divisor with 0-guarding to prevent NaN / Infinity.
 */
export function divideMoney(a: DecimalValue, divisor: number | string | Prisma.Decimal): Prisma.Decimal {
  const div = toDecimal(divisor);
  if (div.isZero()) {
    return new Prisma.Decimal(0);
  }
  return toDecimal(a).div(div);
}

/**
 * Calculates percentage: (part / total) * 100, safe against 0 total.
 */
export function calculatePercentage(part: DecimalValue, total: DecimalValue): number {
  const tot = toDecimal(total);
  if (tot.isZero() || tot.isNegative()) {
    return 0;
  }
  const pct = toDecimal(part).div(tot).mul(100);
  const clamped = Math.min(Math.max(pct.toNumber(), 0), 100);
  return Math.round(clamped * 100) / 100;
}

/**
 * Formats a monetary amount for display using the user's locale and currency code.
 */
export function formatCurrency(
  amount: DecimalValue,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  const num = toDecimal(amount).toNumber();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Fallback if locale or currency code is non-standard
    return `${currency} ${num.toFixed(2)}`;
  }
}

/**
 * Checks if a monetary amount is positive (> 0).
 */
export function isPositiveMoney(amount: DecimalValue): boolean {
  return toDecimal(amount).greaterThan(0);
}

/**
 * Compares two decimal amounts:
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareMoney(a: DecimalValue, b: DecimalValue): number {
  const decA = toDecimal(a);
  const decB = toDecimal(b);
  if (decA.greaterThan(decB)) return 1;
  if (decA.lessThan(decB)) return -1;
  return 0;
}
