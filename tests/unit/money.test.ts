import { describe, it, expect } from 'vitest';
import {
  toDecimal,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  calculatePercentage,
  formatCurrency,
  compareMoney,
  isPositiveMoney,
} from '@/lib/money';
import { Prisma } from '@prisma/client';

describe('Financial Money Math (Decimal-Safe)', () => {
  it('prevents floating point arithmetic errors', () => {
    // Standard JS float error: 0.1 + 0.2 === 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    expect(floatSum).not.toBe(0.3);

    // Decimal-safe sum: 0.10 + 0.20 === 0.30
    const decimalSum = addMoney(0.1, 0.2);
    expect(decimalSum.toString()).toBe('0.3');
  });

  it('correctly adds and subtracts monetary values', () => {
    const a = new Prisma.Decimal('10000.50');
    const b = new Prisma.Decimal('2500.25');

    const sum = addMoney(a, b);
    expect(sum.toString()).toBe('12500.75');

    const diff = subtractMoney(a, b);
    expect(diff.toString()).toBe('7500.25');
  });

  it('multiplies and divides with zero-division protection', () => {
    const amount = new Prisma.Decimal('1000.00');

    const mult = multiplyMoney(amount, 3);
    expect(mult.toString()).toBe('3000');

    const div = divideMoney(amount, 4);
    expect(div.toString()).toBe('250');

    // Zero divisor must return 0 Decimal without throwing or producing NaN/Infinity
    const zeroDiv = divideMoney(amount, 0);
    expect(zeroDiv.isZero()).toBe(true);
    expect(isNaN(zeroDiv.toNumber())).toBe(false);
  });

  it('calculates percentages safely against zero or negative totals', () => {
    // 50 out of 200 = 25%
    expect(calculatePercentage(50, 200)).toBe(25);

    // 0 total should return 0, never NaN or Infinity
    expect(calculatePercentage(100, 0)).toBe(0);

    // Negative total should return 0
    expect(calculatePercentage(100, -500)).toBe(0);

    // Capped at 100%
    expect(calculatePercentage(300, 200)).toBe(100);
  });

  it('formats currency correctly for locale and currency code', () => {
    const formatted = formatCurrency(12500.5, 'INR', 'en-IN');
    expect(formatted).toContain('12,500.50');

    const usdFormatted = formatCurrency(500, 'USD', 'en-US');
    expect(usdFormatted).toContain('500.00');
  });

  it('compares amounts correctly', () => {
    expect(compareMoney(500, 200)).toBe(1);
    expect(compareMoney(200, 500)).toBe(-1);
    expect(compareMoney(100, 100)).toBe(0);

    expect(isPositiveMoney(1)).toBe(true);
    expect(isPositiveMoney(0)).toBe(false);
    expect(isPositiveMoney(-10)).toBe(false);
  });
});
