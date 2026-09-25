import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { BudgetService } from '@/server/services/budget.service';
import { GoalService } from '@/server/services/goal.service';
import { RecurringService } from '@/server/services/recurring.service';
import { AccountType, TxnType, RecurFrequency, BudgetPeriod } from '@prisma/client';

describe('Ledger Math, Transfer Rules & Cross-User Security Isolation', () => {
  let userAId: string;
  let userBId: string;
  let userAAccount1Id: string;
  let userAAccount2Id: string;
  let userBAccountId: string;

  beforeAll(async () => {
    // Clean up any previous test runs
    await prisma.user.deleteMany({
      where: { email: { in: ['test-user-a@finora.test', 'test-user-b@finora.test'] } },
    });

    // Create User A
    const userA = await prisma.user.create({
      data: {
        email: 'test-user-a@finora.test',
        name: 'User Alpha',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    // Create User B
    const userB = await prisma.user.create({
      data: {
        email: 'test-user-b@finora.test',
        name: 'User Beta',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    // Accounts for User A
    const aAcc1 = await AccountService.create(userAId, {
      name: 'Alpha Bank',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 50000,
    });
    userAAccount1Id = aAcc1.id;

    const aAcc2 = await AccountService.create(userAId, {
      name: 'Alpha Savings',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 10000,
    });
    userAAccount2Id = aAcc2.id;

    // Account for User B
    const bAcc = await AccountService.create(userBId, {
      name: 'Beta Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 20000,
    });
    userBAccountId = bAcc.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  });

  it('correctly calculates balance for income and expense transactions', async () => {
    // 1. Record income of 20,000 to Alpha Bank (opening: 50,000)
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 20000,
      description: 'Consulting Income',
      occurredAt: new Date(),
    });

    const accAfterIncome = await AccountService.getById(userAId, userAAccount1Id);
    // 50,000 + 20,000 = 70,000
    expect(accAfterIncome?.currentBalance.toNumber()).toBe(70000);

    // 2. Record expense of 5,000 from Alpha Bank
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 5000,
      description: 'Electronics',
      occurredAt: new Date(),
    });

    const accAfterExpense = await AccountService.getById(userAId, userAAccount1Id);
    // 70,000 - 5,000 = 65,000
    expect(accAfterExpense?.currentBalance.toNumber()).toBe(65000);
  });

  it('implements transfer rule: Account A = -amount, Account B = +amount, never income or expense', async () => {
    // Initial:
    // Alpha Bank = 65,000
    // Alpha Savings = 10,000

    // Transfer 10,000 from Alpha Bank -> Alpha Savings
    const xfer = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      transferAccountId: userAAccount2Id,
      type: TxnType.transfer,
      amount: 10000,
      description: 'Transfer to Savings',
      occurredAt: new Date(),
    });

    expect(xfer.id).toBeDefined();

    const sourceAcc = await AccountService.getById(userAId, userAAccount1Id);
    const destAcc = await AccountService.getById(userAId, userAAccount2Id);

    // Alpha Bank: 65,000 - 10,000 = 55,000
    expect(sourceAcc?.currentBalance.toNumber()).toBe(55000);

    // Alpha Savings: 10,000 + 10,000 = 20,000
    expect(destAcc?.currentBalance.toNumber()).toBe(20000);

    // Verify it is NOT counted in income or expense aggregations
    const incomeAgg = await prisma.transaction.aggregate({
      where: { userId: userAId, type: TxnType.income },
      _sum: { amount: true },
    });
    const expenseAgg = await prisma.transaction.aggregate({
      where: { userId: userAId, type: TxnType.expense },
      _sum: { amount: true },
    });

    expect(incomeAgg._sum.amount?.toNumber()).toBe(20000);
    expect(expenseAgg._sum.amount?.toNumber()).toBe(5000);
  });

  it('CRITICAL SECURITY: prevents cross-user account access and transfers', async () => {
    // User B tries to read User A's account
    const crossRead = await AccountService.getById(userBId, userAAccount1Id);
    expect(crossRead).toBeNull();

    // User B tries to transfer funds from User A's account
    await expect(
      TransactionService.create(userBId, {
        accountId: userAAccount1Id, // User A's account
        transferAccountId: userBAccountId,
        type: TxnType.transfer,
        amount: 5000,
      })
    ).rejects.toThrow();

    // User A tries to transfer to User B's account (not owned by User A)
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        transferAccountId: userBAccountId, // User B's account
        type: TxnType.transfer,
        amount: 5000,
      })
    ).rejects.toThrow();
  });

  it('CRITICAL SECURITY: enforces goal contribution ownership and boundaries', async () => {
    // 1. User A creates a transaction of 5,000
    const userATxn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 5000,
      description: 'Goal Funding Source',
    });

    // 2. User A creates a goal of 10,000
    const goalA = await GoalService.create(userAId, {
      name: 'Emergency Fund',
      targetAmount: 10000,
    });

    // 3. User B tries to contribute to User A's goal -> rejected
    await expect(
      GoalService.contribute(userBId, {
        goalId: goalA.id,
        transactionId: userATxn.id,
        amount: 2000,
      })
    ).rejects.toThrow();

    // 4. User A tries to contribute MORE than transaction amount (6,000 > 5,000) -> rejected
    await expect(
      GoalService.contribute(userAId, {
        goalId: goalA.id,
        transactionId: userATxn.id,
        amount: 6000,
      })
    ).rejects.toThrow();

    // 5. Valid contribution of 5,000
    const contrib = await GoalService.contribute(userAId, {
      goalId: goalA.id,
      transactionId: userATxn.id,
      amount: 5000,
    });
    expect(contrib.id).toBeDefined();

    const updatedGoal = await GoalService.getById(userAId, goalA.id);
    expect(updatedGoal?.currentAmount.toNumber()).toBe(5000);
  });

  it('guarantees recurring transaction catch-up idempotency (zero duplicates)', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    // Create recurring schedule starting 10 days ago (daily)
    const recur = await RecurringService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 100,
      description: 'Daily Interest',
      frequency: RecurFrequency.daily,
      interval: 1,
      startDate: pastDate,
    });

    // Run catch-up first time
    const count1 = await RecurringService.processCatchUp(userAId);
    expect(count1).toBeGreaterThan(0);

    // Run catch-up second time immediately
    const count2 = await RecurringService.processCatchUp(userAId);
    // Must be 0 because all occurrences were already generated!
    expect(count2).toBe(0);

    // Clean up schedule
    await RecurringService.delete(userAId, recur.id);
  });
});
