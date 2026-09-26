import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { createAccountSchema, updateAccountSchema } from '@/lib/validation/account.schema';
import { AccountType, TxnType, Prisma } from '@prisma/client';

describe('Phase 4 — Accounts Management Suite', () => {
  let userAId: string;
  let userBId: string;
  let userAAccount1Id: string;
  let userAAccount2Id: string;
  let userBAccountId: string;

  beforeAll(async () => {
    // Clean up test data from any previous runs
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['account-test-a@finora.test', 'account-test-b@finora.test'],
        },
      },
    });

    // Create User A
    const userA = await prisma.user.create({
      data: {
        email: 'account-test-a@finora.test',
        name: 'Account Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    // Create User B (for cross-user isolation verification)
    const userB = await prisma.user.create({
      data: {
        email: 'account-test-b@finora.test',
        name: 'Account Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  });

  // Test 1: Create account with opening balance
  it('1. creates account with opening balance and initializes current balance', async () => {
    const acc = await AccountService.create(userAId, {
      name: 'Salary Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 25000,
      color: '#059669',
      icon: 'Building',
    });

    expect(acc.id).toBeDefined();
    expect(acc.userId).toBe(userAId);
    expect(acc.name).toBe('Salary Checking');
    expect(acc.type).toBe(AccountType.bank);
    expect(acc.currency).toBe('INR');
    expect(acc.openingBalance.toNumber()).toBe(25000);
    expect(acc.currentBalance.toNumber()).toBe(25000);
    expect(acc.isArchived).toBe(false);

    userAAccount1Id = acc.id;
  });

  // Test 2: Invalid account data rejection
  it('2. strictly validates and rejects invalid account inputs via Zod schema', () => {
    // Empty name
    const emptyName = createAccountSchema.safeParse({
      name: '',
      type: AccountType.bank,
    });
    expect(emptyName.success).toBe(false);

    // Negative credit limit
    const negLimit = createAccountSchema.safeParse({
      name: 'Negative Credit Card',
      type: AccountType.credit_card,
      creditLimit: -500,
    });
    expect(negLimit.success).toBe(false);

    // Invalid account type enum
    const badType = createAccountSchema.safeParse({
      name: 'Crypto Vault',
      type: 'crypto_wallet' as any,
    });
    expect(badType.success).toBe(false);

    // Unknown malicious properties (blocked by .strict())
    const unknownField = createAccountSchema.safeParse({
      name: 'Hacked Account',
      type: AccountType.bank,
      isAdmin: true,
    });
    expect(unknownField.success).toBe(false);
  });

  // Test 3: Duplicate account name rejection for same user
  it('3. rejects duplicate account names for the same user while allowing different users', async () => {
    // Attempt duplicate for User A
    await expect(
      AccountService.create(userAId, {
        name: 'Salary Checking', // already created in Test 1
        type: AccountType.bank,
        openingBalance: 0,
      })
    ).rejects.toThrow('already exists');

    // User B should be permitted to use the same account name
    const userBAcc = await AccountService.create(userBId, {
      name: 'Salary Checking',
      type: AccountType.bank,
      openingBalance: 10000,
    });
    expect(userBAcc.id).toBeDefined();
    expect(userBAcc.userId).toBe(userBId);
    userBAccountId = userBAcc.id;
  });

  // Test 4: Update account details and duplicate name collision
  it('4. updates account details and enforces uniqueness upon renaming', async () => {
    // Create a second account for User A
    const acc2 = await AccountService.create(userAId, {
      name: 'Emergency Fund',
      type: AccountType.bank,
      openingBalance: 50000,
      color: '#2563eb',
    });
    userAAccount2Id = acc2.id;

    // Update acc2 metadata
    const updated = await AccountService.update(userAId, userAAccount2Id, {
      name: 'High Yield Savings',
      color: '#7c3aed',
      icon: 'Shield',
    });
    expect(updated.name).toBe('High Yield Savings');
    expect(updated.color).toBe('#7c3aed');

    // Attempt renaming acc2 to 'Salary Checking' (which already exists for User A)
    await expect(
      AccountService.update(userAId, userAAccount2Id, {
        name: 'Salary Checking',
      })
    ).rejects.toThrow('already exists');
  });

  // Test 5: Archive and restore account
  it('5. archives and restores account correctly', async () => {
    // Archive
    const archived = await AccountService.toggleArchive(userAId, userAAccount2Id, true);
    expect(archived.isArchived).toBe(true);

    // List with archive filter
    const activeOnly = await AccountService.list(userAId, { isArchived: false });
    expect(activeOnly.some((a) => a.id === userAAccount2Id)).toBe(false);

    const withArchived = await AccountService.list(userAId, { isArchived: true });
    expect(withArchived.some((a) => a.id === userAAccount2Id)).toBe(true);

    // Restore
    const restored = await AccountService.toggleArchive(userAId, userAAccount2Id, false);
    expect(restored.isArchived).toBe(false);

    const activeAgain = await AccountService.list(userAId, { isArchived: false });
    expect(activeAgain.some((a) => a.id === userAAccount2Id)).toBe(true);
  });

  // Test 6: Account ownership validation
  it('6. enforces ownership validation and rejects non-existent IDs', async () => {
    const nonExistent = await AccountService.getById(userAId, '00000000-0000-0000-0000-000000000000');
    expect(nonExistent).toBeNull();

    await expect(
      AccountService.update(userAId, '00000000-0000-0000-0000-000000000000', {
        name: 'Ghost Account',
      })
    ).rejects.toThrow('Account not found');
  });

  // Test 7: Cross-user account access rejection
  it('7. strictly prevents User A from accessing, modifying, or deleting User B accounts', async () => {
    // Read attempt by User A on User B's account
    const readAttempt = await AccountService.getById(userAId, userBAccountId);
    expect(readAttempt).toBeNull();

    // Detail attempt by User A on User B's account
    const detailAttempt = await AccountService.getAccountDetail(userAId, userBAccountId);
    expect(detailAttempt).toBeNull();

    // Update attempt
    await expect(
      AccountService.update(userAId, userBAccountId, { name: 'Hijacked' })
    ).rejects.toThrow('Account not found');

    // Archive attempt
    await expect(
      AccountService.toggleArchive(userAId, userBAccountId, true)
    ).rejects.toThrow('Account not found');

    // Delete attempt
    await expect(
      AccountService.delete(userAId, userBAccountId)
    ).rejects.toThrow('Account not found');

    // Confirm User B's account was unmodified
    const untouched = await AccountService.getById(userBId, userBAccountId);
    expect(untouched).not.toBeNull();
    expect(untouched?.name).toBe('Salary Checking');
    expect(untouched?.isArchived).toBe(false);
  });

  // Test 8: Opening balance handling and precision
  it('8. preserves decimal precision and handles initial balance without transactions', async () => {
    const oddAcc = await AccountService.create(userAId, {
      name: 'Precise Odd Account',
      type: AccountType.other,
      openingBalance: 1234.56,
    });

    const fetched = await AccountService.getById(userAId, oddAcc.id);
    expect(fetched?.openingBalance.toString()).toBe('1234.56');
    expect(fetched?.currentBalance.toString()).toBe('1234.56');

    // Clean up empty test account
    await AccountService.delete(userAId, oddAcc.id);
  });

  // Test 9: Balance calculation synchronization with transactions
  it('9. synchronizes balance across income, expense, and bidirectional transfers', async () => {
    // Current state:
    // Account 1 (Salary Checking): opening 25000, current 25000
    // Account 2 (High Yield Savings): opening 50000, current 50000

    // 1. Income of 10,000 to Account 1
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 10000,
      description: 'Monthly Bonus',
      occurredAt: new Date('2026-09-01'),
    });

    const acc1AfterIncome = await AccountService.getById(userAId, userAAccount1Id);
    expect(acc1AfterIncome?.currentBalance.toNumber()).toBe(35000); // 25000 + 10000

    // 2. Expense of 4,000 from Account 1
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 4000,
      description: 'Groceries and Utilities',
      occurredAt: new Date('2026-09-05'),
    });

    const acc1AfterExpense = await AccountService.getById(userAId, userAAccount1Id);
    expect(acc1AfterExpense?.currentBalance.toNumber()).toBe(31000); // 35000 - 4000

    // 3. Outbound Transfer of 6,000 from Account 1 to Account 2
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      transferAccountId: userAAccount2Id,
      type: TxnType.transfer,
      amount: 6000,
      description: 'Transfer to Savings',
      occurredAt: new Date('2026-09-10'),
    });

    const acc1AfterXferOut = await AccountService.getById(userAId, userAAccount1Id);
    const acc2AfterXferIn = await AccountService.getById(userAId, userAAccount2Id);
    expect(acc1AfterXferOut?.currentBalance.toNumber()).toBe(25000); // 31000 - 6000
    expect(acc2AfterXferIn?.currentBalance.toNumber()).toBe(56000); // 50000 + 6000

    // 4. Inbound Transfer of 1,000 from Account 2 back to Account 1
    await TransactionService.create(userAId, {
      accountId: userAAccount2Id,
      transferAccountId: userAAccount1Id,
      type: TxnType.transfer,
      amount: 1000,
      description: 'Emergency withdrawal',
      occurredAt: new Date('2026-09-15'),
    });

    const acc1Final = await AccountService.getById(userAId, userAAccount1Id);
    const acc2Final = await AccountService.getById(userAId, userAAccount2Id);
    expect(acc1Final?.currentBalance.toNumber()).toBe(26000); // 25000 + 1000
    expect(acc2Final?.currentBalance.toNumber()).toBe(55000); // 56000 - 1000
  });

  // Test 10: Account transaction retrieval and account detail DTO
  it('10. retrieves complete account detail, computed flows, and transaction ledger', async () => {
    const detail = await AccountService.getAccountDetail(userAId, userAAccount1Id);
    expect(detail).not.toBeNull();
    if (!detail) return;

    // Verify stats
    expect(detail.stats.openingBalance.toNumber()).toBe(25000);
    expect(detail.stats.currentBalance.toNumber()).toBe(26000);
    expect(detail.stats.totalIncome.toNumber()).toBe(10000);
    expect(detail.stats.totalExpense.toNumber()).toBe(4000);
    expect(detail.stats.totalTransferOut.toNumber()).toBe(6000);
    expect(detail.stats.totalTransferIn.toNumber()).toBe(1000);
    expect(detail.stats.totalInflows.toNumber()).toBe(11000); // 10000 + 1000
    expect(detail.stats.totalOutflows.toNumber()).toBe(10000); // 4000 + 6000
    expect(detail.stats.netChange.toNumber()).toBe(1000); // 11000 - 10000
    expect(detail.stats.transactionCount).toBe(4);

    // Verify recent transactions
    expect(detail.recentTransactions.length).toBe(4);
    // Ordered by occurredAt desc: 15th, 10th, 5th, 1st
    expect(detail.recentTransactions[0].description).toBe('Emergency withdrawal');
    expect(detail.recentTransactions[1].description).toBe('Transfer to Savings');
    expect(detail.recentTransactions[2].description).toBe('Groceries and Utilities');
    expect(detail.recentTransactions[3].description).toBe('Monthly Bonus');
  });

  // Test 11: Destructive deletion protection
  it('11. prevents deletion of accounts with transaction history and permits deletion when safe', async () => {
    // Attempt to delete Account 1 (has 4 transactions)
    await expect(
      AccountService.delete(userAId, userAAccount1Id)
    ).rejects.toThrow(/Cannot delete account.*Please archive it instead/);

    // Attempt to delete Account 2 (has 2 transfer transactions)
    await expect(
      AccountService.delete(userAId, userAAccount2Id)
    ).rejects.toThrow(/Cannot delete account.*Please archive it instead/);

    // Create a new empty account with 0 transactions
    const safeToDelete = await AccountService.create(userAId, {
      name: 'Temporary Account',
      type: AccountType.cash,
      openingBalance: 0,
    });

    // Delete should succeed cleanly
    const deleted = await AccountService.delete(userAId, safeToDelete.id);
    expect(deleted.id).toBe(safeToDelete.id);

    const lookup = await AccountService.getById(userAId, safeToDelete.id);
    expect(lookup).toBeNull();
  });
});
