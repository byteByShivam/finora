import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validation/auth.schema';
import { createTransactionSchema } from '@/lib/validation/transaction.schema';
import { createAccountSchema } from '@/lib/validation/account.schema';
import { AccountType, TxnType } from '@prisma/client';

describe('Zod Validation Schemas (.strict())', () => {
  it('rejects extra unknown fields due to .strict() mode', () => {
    const maliciousPayload = {
      name: 'Test Account',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 1000,
      adminRole: true, // Malicious unknown field
    };

    const res = createAccountSchema.safeParse(maliciousPayload);
    expect(res.success).toBe(false);
  });

  it('validates password complexity on registration', () => {
    // Too short
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@test.com',
        password: 'Pass1',
      }).success
    ).toBe(false);

    // No numbers
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@test.com',
        password: 'PasswordNoNumber',
      }).success
    ).toBe(false);

    // No uppercase
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@test.com',
        password: 'password123',
      }).success
    ).toBe(false);

    // Valid
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@test.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }).success
    ).toBe(true);

    // Password mismatch
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@test.com',
        password: 'Password123!',
        confirmPassword: 'Password456!',
      }).success
    ).toBe(false);
  });

  it('enforces transfer rules: destination required and cannot equal source', () => {
    const acc1 = '11111111-1111-1111-1111-111111111111';

    // Transfer with same account
    const sameAccountTransfer = {
      type: TxnType.transfer,
      accountId: acc1,
      transferAccountId: acc1,
      amount: 500,
    };
    expect(createTransactionSchema.safeParse(sameAccountTransfer).success).toBe(false);

    // Transfer without destination account
    const noDestTransfer = {
      type: TxnType.transfer,
      accountId: acc1,
      amount: 500,
    };
    expect(createTransactionSchema.safeParse(noDestTransfer).success).toBe(false);

    // Valid transfer
    const validTransfer = {
      type: TxnType.transfer,
      accountId: acc1,
      transferAccountId: '22222222-2222-2222-2222-222222222222',
      amount: 500,
    };
    expect(createTransactionSchema.safeParse(validTransfer).success).toBe(true);
  });

  it('rejects zero and negative transaction amounts', () => {
    const acc1 = '11111111-1111-1111-1111-111111111111';

    expect(
      createTransactionSchema.safeParse({
        type: TxnType.expense,
        accountId: acc1,
        amount: 0,
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        type: TxnType.expense,
        accountId: acc1,
        amount: -500,
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        type: TxnType.expense,
        accountId: acc1,
        amount: 500.5,
      }).success
    ).toBe(true);
  });
});
