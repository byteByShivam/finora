import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { BudgetService } from '@/server/services/budget.service';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { CategoryService } from '@/server/services/category.service';
import { AnalyticsService } from '@/server/services/analytics.service';
import {
  createBudgetSchema,
  updateBudgetSchema,
} from '@/lib/validation/budget.schema';
import { AccountType, TxnType, BudgetPeriod, Prisma } from '@prisma/client';
import { subMonths, startOfMonth } from 'date-fns';

describe('Phase 7 — Budget Management Suite', () => {
  let userAId: string;
  let userBId: string;
  let userZeroId: string;

  let userAAccountId: string;
  let userBAccountId: string;

  let userACatGroceriesId: string;
  let userACatDiningId: string;
  let userACatSalaryId: string;
  let userBCatGroceriesId: string;

  let initialBudgetId: string;
  const now = new Date();

  beforeAll(async () => {
    // 1. Clean up old test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'budget-test-a@finora.test',
            'budget-test-b@finora.test',
            'budget-test-zero@finora.test',
          ],
        },
      },
    });

    // 2. Create Users
    const userA = await prisma.user.create({
      data: {
        email: 'budget-test-a@finora.test',
        name: 'Budget Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'budget-test-b@finora.test',
        name: 'Budget Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    const userZero = await prisma.user.create({
      data: {
        email: 'budget-test-zero@finora.test',
        name: 'Zero Budget Tester',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userZeroId = userZero.id;

    // 3. Accounts
    const accA = await AccountService.create(userAId, {
      name: 'User A Checking',
      type: AccountType.bank,
      openingBalance: 100000,
    });
    userAAccountId = accA.id;

    const accB = await AccountService.create(userBId, {
      name: 'User B Checking',
      type: AccountType.bank,
      openingBalance: 50000,
    });
    userBAccountId = accB.id;

    // 4. Categories
    const catGroceries = await CategoryService.create(userAId, {
      name: 'User A Groceries',
      type: 'expense',
      color: '#10b981',
    });
    userACatGroceriesId = catGroceries.id;

    const catDining = await CategoryService.create(userAId, {
      name: 'User A Dining Out',
      type: 'expense',
      color: '#f59e0b',
    });
    userACatDiningId = catDining.id;

    const catSalary = await CategoryService.create(userAId, {
      name: 'User A Salary',
      type: 'income',
      color: '#3b82f6',
    });
    userACatSalaryId = catSalary.id;

    const catBGroceries = await CategoryService.create(userBId, {
      name: 'User B Secret Groceries',
      type: 'expense',
      color: '#ef4444',
    });
    userBCatGroceriesId = catBGroceries.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, userZeroId] } },
    });
    await prisma.$disconnect();
  });

  // Test 1: Create budget with valid input
  it('1. creates budget with valid input and initializes zero spend', async () => {
    const budget = await BudgetService.create(userAId, {
      categoryId: userACatGroceriesId,
      amount: 10000,
      period: BudgetPeriod.monthly,
      periodStart: now,
      rolloverEnabled: false,
      alertThresholdPct: 80,
    });

    expect(budget.id).toBeDefined();
    expect(budget.userId).toBe(userAId);
    expect(budget.categoryId).toBe(userACatGroceriesId);
    expect(budget.amount.toNumber()).toBe(10000);
    expect(budget.period).toBe(BudgetPeriod.monthly);
    expect(budget.alertThresholdPct).toBe(80);

    initialBudgetId = budget.id;

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    expect(list.length).toBe(1);
    expect(list[0].amount).toBe(10000);
    expect(list[0].spent).toBe(0);
    expect(list[0].remaining).toBe(10000);
    expect(list[0].percentage).toBe(0);
    expect(list[0].status).toBe('healthy');
    expect(list[0].isOverBudget).toBe(false);
  });

  // Test 2: Reject invalid budget amount
  it('2. rejects invalid budget amount (negative, zero, NaN, non-finite)', async () => {
    // Zero amount
    expect(() =>
      createBudgetSchema.parse({
        categoryId: userACatGroceriesId,
        amount: 0,
      })
    ).toThrow();

    // Negative amount
    expect(() =>
      createBudgetSchema.parse({
        categoryId: userACatGroceriesId,
        amount: -500,
      })
    ).toThrow();

    // NaN amount
    expect(() =>
      createBudgetSchema.parse({
        categoryId: userACatGroceriesId,
        amount: NaN,
      })
    ).toThrow();

    // Infinity amount
    expect(() =>
      createBudgetSchema.parse({
        categoryId: userACatGroceriesId,
        amount: Infinity,
      })
    ).toThrow();
  });

  // Test 3: Reject duplicate budget for same category and period
  it('3. rejects duplicate budget for same category and period', async () => {
    await expect(
      BudgetService.create(userAId, {
        categoryId: userACatGroceriesId,
        amount: 12000,
        period: BudgetPeriod.monthly,
        periodStart: now,
        rolloverEnabled: false,
        alertThresholdPct: 80,
      })
    ).rejects.toThrow('A budget for this category and period already exists.');
  });

  // Test 4: Category ownership validation
  it('4. validates category ownership and rejects User B category', async () => {
    await expect(
      BudgetService.create(userAId, {
        categoryId: userBCatGroceriesId,
        amount: 5000,
        period: BudgetPeriod.monthly,
        periodStart: now,
        rolloverEnabled: false,
        alertThresholdPct: 80,
      })
    ).rejects.toThrow('Category not found or unauthorized.');
  });

  // Test 5: Rejects budget on non-expense category
  it('5. rejects budget on non-expense categories (e.g. income category)', async () => {
    await expect(
      BudgetService.create(userAId, {
        categoryId: userACatSalaryId,
        amount: 50000,
        period: BudgetPeriod.monthly,
        periodStart: now,
        rolloverEnabled: false,
        alertThresholdPct: 80,
      })
    ).rejects.toThrow('Budgets can only be set for expense categories.');
  });

  // Test 6: Correct initial budget spending (0 spent when no expense transactions exist)
  it('6. computes correct initial budget spending (0 spent when no expense transactions exist)', async () => {
    const detail = await BudgetService.getById(userAId, initialBudgetId);
    expect(detail).not.toBeNull();
    expect(detail?.budget.spent).toBe(0);
    expect(detail?.budget.remaining).toBe(10000);
    expect(detail?.budget.percentage).toBe(0);
    expect(detail?.budget.transactionCount).toBe(0);
    expect(detail?.transactions.length).toBe(0);
  });

  // Test 7: Includes expense transactions in budget spending
  let expense1Id: string;
  it('7. includes expense transactions in budget spending', async () => {
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 4000,
      description: 'First Groceries Run',
      occurredAt: now,
    });
    expense1Id = txn.id;

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b).toBeDefined();
    expect(b?.spent).toBe(4000);
    expect(b?.remaining).toBe(6000);
    expect(b?.percentage).toBe(40);
    expect(b?.status).toBe('healthy');
    expect(b?.isOverBudget).toBe(false);
  });

  // Test 8: Strictly excludes income transactions from budget spending
  it('8. strictly excludes income transactions from budget spending', async () => {
    // Add income transaction
    await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatSalaryId,
      type: TxnType.income,
      amount: 25000,
      description: 'Mid-month Salary',
      occurredAt: now,
    });

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(4000);
    expect(b?.remaining).toBe(6000);
  });

  // Test 9: Strictly excludes transfers from budget spending
  it('9. strictly excludes transfers from budget spending', async () => {
    // Create a temporary secondary account for User A
    const secondaryAcc = await AccountService.create(userAId, {
      name: 'User A Emergency',
      type: AccountType.bank,
      openingBalance: 0,
    });

    // Create transfer
    await TransactionService.create(userAId, {
      accountId: userAAccountId,
      transferAccountId: secondaryAcc.id,
      type: TxnType.transfer,
      amount: 5000,
      description: 'Savings Transfer',
      occurredAt: now,
    });

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(4000);
    expect(b?.remaining).toBe(6000);
  });

  // Test 10: Computes correct remaining amount and percentage used
  let expense2Id: string;
  it('10. computes correct remaining amount and percentage used', async () => {
    // Add 3,500 expense to Groceries (total spent = 7,500 out of 10,000 -> 75%)
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 3500,
      description: 'Second Groceries Trip',
      occurredAt: now,
    });
    expense2Id = txn.id;

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(7500);
    expect(b?.remaining).toBe(2500);
    expect(b?.percentage).toBe(75);
    expect(b?.status).toBe('approaching');
    expect(b?.isOverBudget).toBe(false);
  });

  // Test 11: Budget exceeded state (spent > amount)
  let expense3Id: string;
  it('11. correctly detects and flags budget exceeded state (spent > amount)', async () => {
    // Add 3,500 expense to Groceries (total spent = 11,000 out of 10,000 -> 110%, remaining = -1,000)
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 3500,
      description: 'Over-limit Bulk Purchase',
      occurredAt: now,
    });
    expense3Id = txn.id;

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(11000);
    expect(b?.remaining).toBe(-1000);
    expect(b?.percentage).toBe(110);
    expect(b?.status).toBe('exceeded');
    expect(b?.isOverBudget).toBe(true);
  });

  // Test 12: Editing an expense updates budget spending dynamically
  it('12. editing an expense updates budget spending dynamically', async () => {
    // Edit expense 3 from 3,500 down to 2,000 (total spent = 4,000 + 3,500 + 2,000 = 9,500)
    await TransactionService.update(userAId, expense3Id, {
      amount: 2000,
      description: 'Edited Expense',
    });

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(9500);
    expect(b?.remaining).toBe(500);
    expect(b?.percentage).toBe(95);
    expect(b?.status).toBe('critical');
    expect(b?.isOverBudget).toBe(false);
  });

  // Test 13: Deleting an expense updates budget spending dynamically
  it('13. deleting an expense decreases budget spending dynamically', async () => {
    // Delete expense 3 (2,000). Total spent drops back from 9,500 to 7,500
    await TransactionService.delete(userAId, expense3Id);

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b?.spent).toBe(7500);
    expect(b?.remaining).toBe(2500);
    expect(b?.percentage).toBe(75);
    expect(b?.status).toBe('approaching');
  });

  // Test 14: Changing expense category updates both affected budgets
  let diningBudgetId: string;
  it('14. changing expense category updates both affected budgets', async () => {
    // Create second budget for Dining Out (5,000)
    const diningBudget = await BudgetService.create(userAId, {
      categoryId: userACatDiningId,
      amount: 5000,
      period: BudgetPeriod.monthly,
      periodStart: now,
      rolloverEnabled: false,
      alertThresholdPct: 80,
    });
    diningBudgetId = diningBudget.id;

    // Verify initial Dining Out budget is at 0
    let list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    let d = list.find((item) => item.id === diningBudgetId);
    expect(d?.spent).toBe(0);

    // Reassign expense 2 (3,500) from Groceries to Dining Out
    await TransactionService.update(userAId, expense2Id, {
      categoryId: userACatDiningId,
    });

    list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const g = list.find((item) => item.id === initialBudgetId);
    d = list.find((item) => item.id === diningBudgetId);

    // Groceries has only expense 1 (4,000)
    expect(g?.spent).toBe(4000);
    expect(g?.remaining).toBe(6000);

    // Dining Out now has expense 2 (3,500)
    expect(d?.spent).toBe(3500);
    expect(d?.remaining).toBe(1500);
    expect(d?.percentage).toBe(70);
  });

  // Test 15: Changing expense date outside budget period updates budget inclusion
  it('15. changing expense date outside budget period updates budget inclusion', async () => {
    // Move expense 1 (4,000) to 2 months ago
    const pastDate = subMonths(startOfMonth(now), 2);
    await TransactionService.update(userAId, expense1Id, {
      occurredAt: pastDate,
    });

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const g = list.find((item) => item.id === initialBudgetId);
    // Since expense 1 moved to past, Groceries spent in this month drops to 0!
    expect(g?.spent).toBe(0);
    expect(g?.remaining).toBe(10000);
    expect(g?.percentage).toBe(0);

    // Move expense 1 back to current month
    await TransactionService.update(userAId, expense1Id, {
      occurredAt: now,
    });
    const restoredList = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const restoredG = restoredList.find((item) => item.id === initialBudgetId);
    expect(restoredG?.spent).toBe(4000);
  });

  // Test 16: Cross-user budget read access rejected
  it('16. cross-user budget read access is rejected (returns null)', async () => {
    const detail = await BudgetService.getById(userBId, initialBudgetId);
    expect(detail).toBeNull();
  });

  // Test 17: Cross-user budget modification rejected
  it('17. cross-user budget modification is rejected', async () => {
    await expect(
      BudgetService.update(userBId, initialBudgetId, {
        id: initialBudgetId,
        amount: 20000,
      })
    ).rejects.toThrow('Budget not found.');
  });

  // Test 18: Cross-user budget deletion rejected
  it('18. cross-user budget deletion is rejected', async () => {
    await expect(
      BudgetService.delete(userBId, initialBudgetId)
    ).rejects.toThrow('Budget not found.');
  });

  // Test 19: Deleting a budget does NOT delete transaction ledger history
  it('19. deleting a budget does NOT delete transaction ledger history', async () => {
    // Delete Dining Out budget (which has expense 2: 3,500)
    await BudgetService.delete(userAId, diningBudgetId);

    // Verify budget is gone
    const lookup = await BudgetService.getById(userAId, diningBudgetId);
    expect(lookup).toBeNull();

    // Verify transaction 2 still exists
    const txn = await TransactionService.getById(userAId, expense2Id);
    expect(txn).not.toBeNull();
    expect(txn?.amount.toNumber()).toBe(3500);
  });

  // Test 20: Zero-data budget state returns safe empty structures and zero totals
  it('20. zero-data budget state returns safe empty structures and zero totals', async () => {
    const list = await BudgetService.getForPeriod(userZeroId, now, BudgetPeriod.monthly);
    expect(list.length).toBe(0);

    const summary = BudgetService.getSummaryStats(list);
    expect(summary.totalBudgeted).toBe(0);
    expect(summary.totalSpent).toBe(0);
    expect(summary.totalRemaining).toBe(0);
    expect(summary.overallPercentage).toBe(0);
    expect(summary.budgetCount).toBe(0);
    expect(summary.exceededCount).toBe(0);
    expect(Number.isNaN(summary.overallPercentage)).toBe(false);
    expect(Number.isFinite(summary.overallPercentage)).toBe(true);
  });

  // Test 21: Preserves decimal precision for financial calculations without floating-point creep
  it('21. preserves decimal precision for financial calculations without floating-point creep', async () => {
    // Create precise decimal budget for Groceries (update amount to 1234.56)
    await BudgetService.update(userAId, initialBudgetId, {
      id: initialBudgetId,
      amount: 1234.56,
    });

    // Delete existing transactions for a clean precision test
    await TransactionService.delete(userAId, expense1Id);
    await TransactionService.delete(userAId, expense2Id);

    // Add precision expense: 234.56
    await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 234.56,
      occurredAt: now,
    });

    // Add another precision expense: 500.00
    await TransactionService.create(userAId, {
      accountId: userAAccountId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 500.00,
      occurredAt: now,
    });

    const list = await BudgetService.getForPeriod(userAId, now, BudgetPeriod.monthly);
    const b = list.find((item) => item.id === initialBudgetId);
    expect(b).toBeDefined();
    // 234.56 + 500.00 = 734.56
    expect(b?.spent).toBe(734.56);
    // 1234.56 - 734.56 = 500.00
    expect(b?.remaining).toBe(500.00);
    // Percentage = (734.56 / 1234.56) * 100 = 59.50%
    expect(b?.percentage).toBe(59.5);
  });

  // Test 22: Dashboard integration includes active budgets with accurate spent and remaining
  it('22. Dashboard integration includes active budgets with accurate spent and remaining', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);
    expect(snapshot.budgets).toBeDefined();
    expect(snapshot.budgets.length).toBeGreaterThan(0);

    const b = snapshot.budgets.find((item) => item.id === initialBudgetId);
    expect(b).toBeDefined();
    expect(b?.categoryName).toBe('User A Groceries');
    expect(b?.amount).toBe(1234.56);
    expect(b?.spent).toBe(734.56);
    expect(b?.remaining).toBe(500.00);
  });
});
