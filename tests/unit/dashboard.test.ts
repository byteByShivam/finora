import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { AnalyticsService } from '@/server/services/analytics.service';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { CategoryService } from '@/server/services/category.service';
import { requireUser } from '@/server/auth/session';
import { AccountType, TxnType, Prisma } from '@prisma/client';
import { subDays, startOfMonth, format } from 'date-fns';

describe('Phase 6 — Financial Dashboard Suite', () => {
  let userAId: string;
  let userBId: string;
  let userZeroId: string;

  let userACheckingId: string;
  let userACCId: string;
  let userAArchivedId: string;
  let userBCheckingId: string;

  let userACatSalaryId: string;
  let userACatGroceriesId: string;
  let userACatUtilitiesId: string;
  let userBCatSecretId: string;

  const now = new Date();
  const pastDate = subDays(startOfMonth(now), 45); // 45 days before start of this month

  beforeAll(async () => {
    // 1. Clean up any existing test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'dash-test-a@finora.test',
            'dash-test-b@finora.test',
            'dash-test-zero@finora.test',
          ],
        },
      },
    });

    // 2. Create User A, User B, and Zero-data User
    const userA = await prisma.user.create({
      data: {
        email: 'dash-test-a@finora.test',
        name: 'Dashboard Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'dash-test-b@finora.test',
        name: 'Dashboard Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    const userZero = await prisma.user.create({
      data: {
        email: 'dash-test-zero@finora.test',
        name: 'Zero Data Tester',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userZeroId = userZero.id;

    // 3. Categories
    const catSalary = await CategoryService.create(userAId, {
      name: 'User A Salary',
      type: 'income',
      icon: 'Briefcase',
    });
    userACatSalaryId = catSalary.id;

    const catGroceries = await CategoryService.create(userAId, {
      name: 'User A Groceries',
      type: 'expense',
      icon: 'ShoppingCart',
      color: '#10b981',
    });
    userACatGroceriesId = catGroceries.id;

    const catUtilities = await CategoryService.create(userAId, {
      name: 'User A Utilities',
      type: 'expense',
      icon: 'Zap',
      color: '#f59e0b',
    });
    userACatUtilitiesId = catUtilities.id;

    const catBSecret = await CategoryService.create(userBId, {
      name: 'User B Secret Expense',
      type: 'expense',
      icon: 'Shield',
      color: '#ef4444',
    });
    userBCatSecretId = catBSecret.id;

    // 4. Accounts
    // User A Checking: opening 50,000
    const aChecking = await AccountService.create(userAId, {
      name: 'Alpha Bank Checking',
      type: AccountType.bank,
      openingBalance: 50000,
      color: '#3b82f6',
    });
    userACheckingId = aChecking.id;

    // User A Credit Card: opening 0, limit 100,000
    const aCC = await AccountService.create(userAId, {
      name: 'Alpha Credit Card',
      type: AccountType.credit_card,
      openingBalance: 0,
      creditLimit: 100000,
      color: '#ef4444',
    });
    userACCId = aCC.id;

    // User A Archived Account: opening 25,000, archived
    const aArchived = await AccountService.create(userAId, {
      name: 'Alpha Old Term Deposit',
      type: AccountType.bank,
      openingBalance: 25000,
    });
    userAArchivedId = aArchived.id;
    await AccountService.toggleArchive(userAId, userAArchivedId, true);

    // User B Checking: opening 20,000
    const bChecking = await AccountService.create(userBId, {
      name: 'Beta Bank Checking',
      type: AccountType.bank,
      openingBalance: 20000,
    });
    userBCheckingId = bChecking.id;

    // 5. Transactions for User A (This Month)
    // T1: Income to checking (60,000.50)
    await TransactionService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatSalaryId,
      type: TxnType.income,
      amount: 60000.50,
      description: 'Monthly Engineering Salary',
      occurredAt: now,
    });

    // T2: Expense from checking (15,000.25)
    await TransactionService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 15000.25,
      description: 'Supermarket Groceries',
      occurredAt: now,
    });

    // T3: Expense from credit card (5,000.25)
    await TransactionService.create(userAId, {
      accountId: userACCId,
      categoryId: userACatUtilitiesId,
      type: TxnType.expense,
      amount: 5000.25,
      description: 'Monthly Electricity & Internet',
      occurredAt: now,
    });

    // T4: Transfer from checking to credit card (4,000.00)
    await TransactionService.create(userAId, {
      accountId: userACheckingId,
      transferAccountId: userACCId,
      type: TxnType.transfer,
      amount: 4000.00,
      description: 'Credit Card Bill Payment',
      occurredAt: now,
    });

    // T5: Past transaction for User A outside this month (8,000.00)
    await TransactionService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatGroceriesId,
      type: TxnType.expense,
      amount: 8000.00,
      description: 'Previous Quarter Bulk Groceries',
      occurredAt: pastDate,
    });

    // 6. Transactions for User B (for cross-user isolation verification)
    await TransactionService.create(userBId, {
      accountId: userBCheckingId,
      type: TxnType.income,
      amount: 99999.00,
      description: 'Beta Consulting Retainer',
      occurredAt: now,
    });

    await TransactionService.create(userBId, {
      accountId: userBCheckingId,
      categoryId: userBCatSecretId,
      type: TxnType.expense,
      amount: 33333.00,
      description: 'Beta Confidential Expense',
      occurredAt: now,
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, userZeroId] } },
    });
    await prisma.$disconnect();
  });

  // Test 1: Authenticated dashboard access
  it('1. authenticated dashboard retrieval returns valid snapshot structure', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    expect(snapshot).toBeDefined();
    expect(snapshot.period.key).toBe('this_month');
    expect(snapshot.period.from).toBeDefined();
    expect(snapshot.period.to).toBeDefined();
    expect(snapshot.metrics).toBeDefined();
    expect(Array.isArray(snapshot.accounts)).toBe(true);
    expect(Array.isArray(snapshot.categoryBreakdown)).toBe(true);
    expect(Array.isArray(snapshot.cashFlowTrend)).toBe(true);
    expect(Array.isArray(snapshot.recentTransactions)).toBe(true);
    expect(snapshot.hasAccounts).toBe(true);
    expect(snapshot.hasTransactions).toBe(true);
    expect(snapshot.hasPeriodActivity).toBe(true);
  });

  // Test 2: Unauthenticated dashboard access
  it('2. unauthenticated access is rejected by session security', async () => {
    // requireUser() expects an active session cookie, throwing UNAUTHORIZED when invoked without one
    await expect(requireUser()).rejects.toThrow('UNAUTHORIZED');
  });

  // Test 3: Correct total balance across accounts (liquid assets - credit card liabilities)
  it('3. computes correct total net balance across liquid assets minus credit debt', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);

    // Checking: 50000 + 60000.50 - 15000.25 - 4000.00 - 8000.00 = 83000.25
    // Credit card: 0 - 5000.25 + 4000.00 = -1000.25 (liability = 1000.25)
    // Archived savings: 25000.00 (excluded because it is archived)
    // Net balance = 83000.25 - 1000.25 = 82000.00
    expect(snapshot.metrics.totalBalance).toBe(82000.00);
  });

  // Test 4: Correct period income (excluding transfers)
  it('4. computes correct period income excluding transfers', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // In this_month, User A has exactly 1 income transaction of 60,000.50
    expect(snapshot.metrics.periodIncome).toBe(60000.50);
  });

  // Test 5: Correct period expenses (excluding transfers)
  it('5. computes correct period expenses excluding transfers', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // In this_month, User A has 2 expense transactions: 15,000.25 + 5,000.25 = 20,000.50
    // (excludes past expense of 8,000.00 and excludes transfer of 4,000.00)
    expect(snapshot.metrics.periodExpense).toBe(20000.50);
  });

  // Test 6: Correct net cash flow (Income - Expenses)
  it('6. computes correct net cash flow as (Income - Expenses)', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // 60,000.50 - 20,000.50 = 40,000.00
    expect(snapshot.metrics.netCashFlow).toBe(40000.00);
    // Savings rate = (40,000 / 60,000.50) * 100 = 66.67%
    expect(snapshot.metrics.savingsRate).toBe(66.67);
  });

  // Test 7: Transfers excluded from income
  it('7. strictly excludes inbound transfers from period income', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // User A had a 4,000 transfer into Credit Card account.
    // Total income must remain strictly 60,000.50 and NOT 64,000.50.
    expect(snapshot.metrics.periodIncome).toBe(60000.50);
  });

  // Test 8: Transfers excluded from expenses
  it('8. strictly excludes outbound transfers from period expenses', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // User A had a 4,000 transfer out of Checking account.
    // Total expenses must remain strictly 20,000.50 and NOT 24,000.50.
    expect(snapshot.metrics.periodExpense).toBe(20000.50);
  });

  // Test 9: Category spending aggregation and percentage calculation
  it('9. correctly aggregates category spending and calculates exact percentages', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // Categories in this_month:
    // User A Groceries: 15,000.25 (75.00%)
    // User A Utilities: 5,000.25 (25.00%)
    expect(snapshot.categoryBreakdown.length).toBe(2);

    const groceries = snapshot.categoryBreakdown.find((c) => c.name === 'User A Groceries');
    const utilities = snapshot.categoryBreakdown.find((c) => c.name === 'User A Utilities');

    expect(groceries).toBeDefined();
    expect(groceries?.amount).toBe(15000.25);
    expect(groceries?.percentage).toBe(75);

    expect(utilities).toBeDefined();
    expect(utilities?.amount).toBe(5000.25);
    expect(utilities?.percentage).toBe(25);
  });

  // Test 10: Monthly and daily time-bucket trend aggregation
  it('10. dynamically switches time-bucket aggregation between daily and monthly trends', async () => {
    // 1. Single month period (this_month) -> diffDays <= 35 -> daily intervals
    const dailySnapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });
    expect(dailySnapshot.cashFlowTrend.length).toBeGreaterThan(20);
    // Dates formatted like '01 Sep', '15 Sep'
    expect(dailySnapshot.cashFlowTrend[0].date).toMatch(/^\d{2}\s[A-Za-z]{3}$/);

    // 2. Year period (this_year) -> diffDays > 35 -> monthly intervals
    const monthlySnapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_year',
    });
    expect(monthlySnapshot.cashFlowTrend.length).toBe(12);
    // Dates formatted like 'Jan 2026', 'Sep 2026'
    expect(monthlySnapshot.cashFlowTrend[0].date).toMatch(/^[A-Za-z]{3}\s\d{4}$/);
  });

  // Test 11: Recent transaction retrieval (ordered by occurredAt descending)
  it('11. retrieves recent transactions ordered by occurredAt descending', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);

    expect(snapshot.recentTransactions.length).toBeLessThanOrEqual(6);
    expect(snapshot.recentTransactions.length).toBeGreaterThanOrEqual(4);

    // Verify ordering: newest first
    for (let i = 0; i < snapshot.recentTransactions.length - 1; i++) {
      const current = new Date(snapshot.recentTransactions[i].occurredAt).getTime();
      const next = new Date(snapshot.recentTransactions[i + 1].occurredAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  // Test 12: Archived account handling
  it('12. handles archived accounts by excluding them from active net balance and allocation breakdown', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);

    // User A has 3 accounts total, but 1 is archived
    const accountNames = snapshot.accounts.map((a) => a.name);
    expect(accountNames).toContain('Alpha Bank Checking');
    expect(accountNames).toContain('Alpha Credit Card');
    expect(accountNames).not.toContain('Alpha Old Term Deposit');

    // Confirm archived account balance (25,000) was excluded from totalBalance
    expect(snapshot.metrics.totalBalance).toBe(82000.00);
  });

  // Test 13: Zero-data dashboard (brand new user)
  it('13. handles zero-data state gracefully with safe zero defaults and zero savings rate (no NaN/Infinity)', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userZeroId);

    expect(snapshot.metrics.totalBalance).toBe(0);
    expect(snapshot.metrics.periodIncome).toBe(0);
    expect(snapshot.metrics.periodExpense).toBe(0);
    expect(snapshot.metrics.netCashFlow).toBe(0);
    expect(snapshot.metrics.savingsRate).toBe(0);
    expect(Number.isNaN(snapshot.metrics.savingsRate)).toBe(false);
    expect(Number.isFinite(snapshot.metrics.savingsRate)).toBe(true);

    expect(snapshot.accounts.length).toBe(0);
    expect(snapshot.categoryBreakdown.length).toBe(0);
    expect(snapshot.recentTransactions.length).toBe(0);
    expect(snapshot.hasAccounts).toBe(false);
    expect(snapshot.hasTransactions).toBe(false);
    expect(snapshot.hasPeriodActivity).toBe(false);
  });

  // Test 14: Custom date range filtering
  it('14. filters metrics and transactions accurately for custom date range', async () => {
    // Query only the past date range (covering T5: 8,000.00 bulk groceries)
    const customFrom = subDays(pastDate, 2);
    const customTo = subDays(pastDate, -2);

    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'custom',
      from: customFrom,
      to: customTo,
    });

    expect(snapshot.period.key).toBe('custom');
    expect(snapshot.metrics.periodIncome).toBe(0);
    expect(snapshot.metrics.periodExpense).toBe(8000.00);
    expect(snapshot.metrics.netCashFlow).toBe(-8000.00);
    expect(snapshot.categoryBreakdown.length).toBe(1);
    expect(snapshot.categoryBreakdown[0].name).toBe('User A Groceries');
    expect(snapshot.categoryBreakdown[0].amount).toBe(8000.00);
  });

  // Test 15: Cross-user data isolation
  it('15. strictly enforces cross-user data isolation', async () => {
    const snapshotA = await AnalyticsService.getDashboardSnapshot(userAId);
    const snapshotB = await AnalyticsService.getDashboardSnapshot(userBId);

    // Verify User A does not see User B's accounts or categories
    const aAccountNames = snapshotA.accounts.map((a) => a.name);
    expect(aAccountNames).not.toContain('Beta Bank Checking');

    const aCatNames = snapshotA.categoryBreakdown.map((c) => c.name);
    expect(aCatNames).not.toContain('User B Secret Expense');

    const aTxnDescriptions = snapshotA.recentTransactions.map((t) => t.description);
    expect(aTxnDescriptions).not.toContain('Beta Consulting Retainer');
    expect(aTxnDescriptions).not.toContain('Beta Confidential Expense');

    // Verify User B does not see User A's data
    const bAccountNames = snapshotB.accounts.map((a) => a.name);
    expect(bAccountNames).not.toContain('Alpha Bank Checking');
    expect(snapshotB.metrics.periodIncome).toBe(99999.00);
    expect(snapshotB.metrics.periodExpense).toBe(33333.00);
  });

  // Test 16: Decimal precision preservation
  it('16. preserves full decimal precision for financial calculations without floating-point drift', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId, {
      period: 'this_month',
    });

    // 60000.50 - 20000.50 in floating point can produce 39999.99999999999
    // But with Prisma.Decimal, netCashFlow is exactly 40000.00
    expect(snapshot.metrics.netCashFlow).toBe(40000.00);
    expect(snapshot.metrics.periodIncome).toBe(60000.50);
    expect(snapshot.metrics.periodExpense).toBe(20000.50);

    // Sum of category breakdown amounts equals periodExpense exactly
    const catSum = snapshot.categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
    expect(catSum).toBe(snapshot.metrics.periodExpense);
  });
});
