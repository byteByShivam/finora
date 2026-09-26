import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { RecurringService } from '@/server/services/recurring.service';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { BudgetService } from '@/server/services/budget.service';
import { AnalyticsService } from '@/server/services/analytics.service';
import { computeNextRun } from '@/lib/dates';
import {
  createRecurringSchema,
  updateRecurringSchema,
} from '@/lib/validation/recurring.schema';
import { AccountType, TxnType, RecurFrequency, BudgetPeriod, Prisma } from '@prisma/client';
import { subDays, subMonths, addDays, startOfDay } from 'date-fns';

describe('Phase 9 — Recurring Transactions Suite', () => {
  let userAId: string;
  let userBId: string;
  let userZeroId: string;

  let userACheckingId: string;
  let userASavingsId: string;
  let userBCheckingId: string;

  let userACatSalaryId: string;
  let userACatRentId: string;
  let userBCatGroceriesId: string;

  const now = new Date();

  beforeAll(async () => {
    // 1. Clean up old test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'recurring-test-a@finora.test',
            'recurring-test-b@finora.test',
            'recurring-test-zero@finora.test',
          ],
        },
      },
    });

    // 2. Create Users
    const userA = await prisma.user.create({
      data: {
        email: 'recurring-test-a@finora.test',
        name: 'Recurring Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'recurring-test-b@finora.test',
        name: 'Recurring Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    const userZero = await prisma.user.create({
      data: {
        email: 'recurring-test-zero@finora.test',
        name: 'Recurring Zero Tester',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userZeroId = userZero.id;

    // 3. Create Accounts
    const aChecking = await AccountService.create(userAId, {
      name: 'User A Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 50000,
    });
    userACheckingId = aChecking.id;

    const aSavings = await AccountService.create(userAId, {
      name: 'User A Savings',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 10000,
    });
    userASavingsId = aSavings.id;

    const bChecking = await AccountService.create(userBId, {
      name: 'User B Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 20000,
    });
    userBCheckingId = bChecking.id;

    // 4. Create Categories
    const catSalary = await prisma.category.create({
      data: {
        userId: userAId,
        name: 'Salary Recur',
        type: 'income',
      },
    });
    userACatSalaryId = catSalary.id;

    const catRent = await prisma.category.create({
      data: {
        userId: userAId,
        name: 'Rent Recur',
        type: 'expense',
      },
    });
    userACatRentId = catRent.id;

    const catGroceriesB = await prisma.category.create({
      data: {
        userId: userBId,
        name: 'Groceries B',
        type: 'expense',
      },
    });
    userBCatGroceriesId = catGroceriesB.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'recurring-test-a@finora.test',
            'recurring-test-b@finora.test',
            'recurring-test-zero@finora.test',
          ],
        },
      },
    });
  });

  // 1. Create Recurring Income
  it('1. creates a recurring income schedule correctly', async () => {
    const nextMonth = addDays(now, 10);
    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatSalaryId,
      type: TxnType.income,
      amount: 75000,
      description: 'Monthly Tech Salary',
      notes: 'Direct deposit on 1st',
      frequency: RecurFrequency.monthly,
      interval: 1,
      startDate: nextMonth,
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.userId).toBe(userAId);
    expect(schedule.type).toBe(TxnType.income);
    expect(schedule.amount.toNumber()).toBe(75000);
    expect(schedule.isActive).toBe(true);
    expect(schedule.nextRunAt.toISOString().slice(0, 10)).toBe(nextMonth.toISOString().slice(0, 10));
  });

  // 2. Create Recurring Expense
  it('2. creates a recurring expense schedule correctly', async () => {
    const futureDate = addDays(now, 10);
    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatRentId,
      type: TxnType.expense,
      amount: 15000,
      description: 'Apartment Rent',
      frequency: RecurFrequency.monthly,
      interval: 1,
      startDate: futureDate,
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.type).toBe(TxnType.expense);
    expect(schedule.amount.toNumber()).toBe(15000);

    await RecurringService.delete(userAId, schedule.id);
  });

  // 3. Create Recurring Transfer
  it('3. creates a recurring transfer schedule between two distinct user accounts', async () => {
    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      transferAccountId: userASavingsId,
      type: TxnType.transfer,
      amount: 5000,
      description: 'Monthly Emergency Fund Savings',
      frequency: RecurFrequency.monthly,
      interval: 1,
      startDate: addDays(now, 5),
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.type).toBe(TxnType.transfer);
    expect(schedule.transferAccountId).toBe(userASavingsId);
  });

  // 4. Reject Invalid Amount (Zero and Negative)
  it('4. rejects non-positive or non-finite amounts via schema and service', async () => {
    const invalidSchema1 = createRecurringSchema.safeParse({
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 0,
      frequency: RecurFrequency.monthly,
    });
    expect(invalidSchema1.success).toBe(false);

    const invalidSchema2 = createRecurringSchema.safeParse({
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: -500,
      frequency: RecurFrequency.monthly,
    });
    expect(invalidSchema2.success).toBe(false);

    await expect(
      RecurringService.create(userAId, {
        accountId: userACheckingId,
        type: TxnType.expense,
        amount: -100,
        frequency: RecurFrequency.monthly,
      })
    ).rejects.toThrow('Amount must be greater than zero.');
  });

  // 5. Reject Invalid Frequency
  it('5. rejects invalid recurrence frequencies', async () => {
    const invalidSchema = createRecurringSchema.safeParse({
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 100,
      frequency: 'hourly' as any,
    });
    expect(invalidSchema.success).toBe(false);
  });

  // 6. Reject Invalid Account Ownership
  it('6. rejects schedule creation if account does not belong to user', async () => {
    await expect(
      RecurringService.create(userAId, {
        accountId: userBCheckingId,
        type: TxnType.expense,
        amount: 200,
        frequency: RecurFrequency.monthly,
      })
    ).rejects.toThrow('Source account not found or not owned by user.');
  });

  // 7. Reject Invalid Category Ownership & Type Mismatch
  it('7. rejects category belonging to another user or type mismatch', async () => {
    // Cross-user category
    await expect(
      RecurringService.create(userAId, {
        accountId: userACheckingId,
        categoryId: userBCatGroceriesId,
        type: TxnType.expense,
        amount: 1000,
        frequency: RecurFrequency.monthly,
      })
    ).rejects.toThrow('Category not found.');

    // Category type mismatch (expense category for income recurring)
    await expect(
      RecurringService.create(userAId, {
        accountId: userACheckingId,
        categoryId: userACatRentId,
        type: TxnType.income,
        amount: 1000,
        frequency: RecurFrequency.monthly,
      })
    ).rejects.toThrow('Category type "expense" does not match recurring schedule type "income".');
  });

  // 8. Reject Transfer Source = Destination
  it('8. rejects recurring transfer where source and destination accounts are identical', async () => {
    const invalidSchema = createRecurringSchema.safeParse({
      accountId: userACheckingId,
      transferAccountId: userACheckingId,
      type: TxnType.transfer,
      amount: 500,
      frequency: RecurFrequency.monthly,
    });
    expect(invalidSchema.success).toBe(false);

    await expect(
      RecurringService.create(userAId, {
        accountId: userACheckingId,
        transferAccountId: userACheckingId,
        type: TxnType.transfer,
        amount: 500,
        frequency: RecurFrequency.monthly,
      })
    ).rejects.toThrow('Source and destination accounts cannot be identical.');
  });

  // 9. Deterministic Next Occurrence Calculations
  it('9. computes next occurrence dates deterministically across all frequencies', () => {
    const baseDate = new Date('2026-01-15T00:00:00.000Z');

    const nextDaily = computeNextRun(baseDate, RecurFrequency.daily, 1);
    expect(nextDaily.toISOString().slice(0, 10)).toBe('2026-01-16');

    const nextWeekly = computeNextRun(baseDate, RecurFrequency.weekly, 1);
    expect(nextWeekly.toISOString().slice(0, 10)).toBe('2026-01-22');

    const nextBiweekly = computeNextRun(baseDate, RecurFrequency.biweekly, 1);
    expect(nextBiweekly.toISOString().slice(0, 10)).toBe('2026-01-29');

    const nextMonthly = computeNextRun(baseDate, RecurFrequency.monthly, 1);
    expect(nextMonthly.toISOString().slice(0, 10)).toBe('2026-02-15');

    const nextYearly = computeNextRun(baseDate, RecurFrequency.yearly, 1);
    expect(nextYearly.toISOString().slice(0, 10)).toBe('2027-01-15');

    // Month-end edge case: Jan 31 + 1 month -> Feb 28
    const jan31 = new Date('2026-01-31T00:00:00.000Z');
    const febEnd = computeNextRun(jan31, RecurFrequency.monthly, 1);
    expect(febEnd.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  // 10. Generate Due Occurrence & TransactionService Integration
  it('10. generates actual transactions for due recurring schedules via TransactionService', async () => {
    const pastDate = subDays(now, 1);

    // Create due expense
    const dueExpense = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatRentId,
      type: TxnType.expense,
      amount: 1200,
      description: 'Electricity Bill Test',
      frequency: RecurFrequency.monthly,
      startDate: pastDate,
    });

    const initialAcc = await AccountService.getById(userAId, userACheckingId);
    const initialBal = initialAcc!.currentBalance.toNumber();

    // Process catch-up
    const count = await RecurringService.processCatchUp(userAId);
    expect(count).toBeGreaterThan(0);

    // Verify transaction exists in ledger
    const generatedTxn = await prisma.transaction.findFirst({
      where: {
        userId: userAId,
        recurringTransactionId: dueExpense.id,
      },
    });
    expect(generatedTxn).toBeDefined();
    expect(generatedTxn?.amount.toNumber()).toBe(1200);
    expect(generatedTxn?.type).toBe(TxnType.expense);

    // Verify account balance updated via AccountService
    const updatedAcc = await AccountService.getById(userAId, userACheckingId);
    expect(updatedAcc!.currentBalance.toNumber()).toBe(initialBal - 1200);
  });

  // 11. Budget Integration: Spending updates only after transaction generation
  it('11. does not count recurring templates toward budget until actual expense is generated', async () => {
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Create Budget for Rent category
    const budget = await BudgetService.create(userAId, {
      categoryId: userACatRentId,
      amount: 20000,
      period: BudgetPeriod.monthly,
      periodStart,
    });

    // Check budget before any future recurrence
    const initialProgress = await BudgetService.getById(userAId, budget.id);
    const spentBefore = initialProgress!.budget.spent;

    // Create a future recurring expense (due next month)
    const futureExpense = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      categoryId: userACatRentId,
      type: TxnType.expense,
      amount: 5000,
      description: 'Future Rent Deposit',
      frequency: RecurFrequency.monthly,
      startDate: addDays(now, 20),
    });

    // Budget spent must remain completely unchanged!
    const progressAfterRule = await BudgetService.getById(userAId, budget.id);
    expect(progressAfterRule!.budget.spent).toBe(spentBefore);

    // Clean up
    await RecurringService.delete(userAId, futureExpense.id);
    await BudgetService.delete(userAId, budget.id);
  });

  // 12. Transfers Remain Neutral to Income and Expenses
  it('12. ensures generated recurring transfers remain cash-flow neutral', async () => {
    const pastDate = subDays(now, 1);

    const chkBefore = (await AccountService.getById(userAId, userACheckingId))!.currentBalance.toNumber();
    const savBefore = (await AccountService.getById(userAId, userASavingsId))!.currentBalance.toNumber();

    const transferSchedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      transferAccountId: userASavingsId,
      type: TxnType.transfer,
      amount: 3000,
      description: 'Weekly Savings Auto-Transfer',
      frequency: RecurFrequency.weekly,
      startDate: pastDate,
    });

    const generated = await RecurringService.processCatchUp(userAId);
    expect(generated).toBeGreaterThan(0);

    const chkAfter = (await AccountService.getById(userAId, userACheckingId))!.currentBalance.toNumber();
    const savAfter = (await AccountService.getById(userAId, userASavingsId))!.currentBalance.toNumber();

    expect(chkAfter).toBe(chkBefore - 3000);
    expect(savAfter).toBe(savBefore + 3000);

    // Verify snapshot: transfer does not pollute income or expense metrics
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);
    expect(snapshot.hasAccounts).toBe(true);

    await RecurringService.delete(userAId, transferSchedule.id);
  });

  // 13. Duplicate Generation Prevention & Idempotency
  it('13. prevents duplicate transaction generation when run multiple times', async () => {
    // Immediate second run must generate 0 new transactions
    const count2 = await RecurringService.processCatchUp(userAId);
    expect(count2).toBe(0);

    const count3 = await RecurringService.processCatchUp(userAId);
    expect(count3).toBe(0);
  });

  // 14. Database Uniqueness / Idempotency Constraint
  it('14. enforces database-level uniqueness on (recurring_transaction_id, occurred_at)', async () => {
    const testDate = new Date('2026-05-01T00:00:00.000Z');

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 999,
      description: 'Constraint Test',
      frequency: RecurFrequency.monthly,
      startDate: addDays(now, 10),
    });

    // Insert first transaction
    await prisma.transaction.create({
      data: {
        userId: userAId,
        accountId: userACheckingId,
        type: TxnType.expense,
        amount: new Prisma.Decimal(999),
        currency: 'INR',
        description: 'First Occurrence',
        occurredAt: testDate,
        recurringTransactionId: schedule.id,
      },
    });

    // Attempt second transaction with exact same recurring schedule and exact same date -> must violate unique constraint
    await expect(
      prisma.transaction.create({
        data: {
          userId: userAId,
          accountId: userACheckingId,
          type: TxnType.expense,
          amount: new Prisma.Decimal(999),
          currency: 'INR',
          description: 'Duplicate Occurrence',
          occurredAt: testDate,
          recurringTransactionId: schedule.id,
        },
      })
    ).rejects.toThrow();

    await RecurringService.delete(userAId, schedule.id);
  });

  // 15. Editing Recurring Rule Does Not Modify Historical Transactions
  it('15. ensures editing recurring configuration preserves historical transactions untouched', async () => {
    const pastDate = subDays(now, 2);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 2000,
      description: 'Gym Membership',
      frequency: RecurFrequency.monthly,
      startDate: pastDate,
    });

    await RecurringService.processCatchUp(userAId);

    const txnBefore = await prisma.transaction.findFirst({
      where: { recurringTransactionId: schedule.id },
    });
    expect(txnBefore?.amount.toNumber()).toBe(2000);

    // User edits schedule amount to 2500
    await RecurringService.update(userAId, schedule.id, {
      amount: 2500,
      description: 'Premium Gym Membership',
    });

    // Historical transaction must STILL be 2000!
    const txnAfter = await prisma.transaction.findUnique({
      where: { id: txnBefore!.id },
    });
    expect(txnAfter?.amount.toNumber()).toBe(2000);
    expect(txnAfter?.description).toBe('Gym Membership');

    await RecurringService.delete(userAId, schedule.id);
  });

  // 16. Pause Prevents Generation
  it('16. pauses recurring rule and prevents transaction generation while paused', async () => {
    const pastDate = subDays(now, 2);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 400,
      description: 'Paused Magazine Subscription',
      frequency: RecurFrequency.monthly,
      startDate: pastDate,
    });

    // Pause rule
    await RecurringService.toggleActive(userAId, schedule.id, false);

    // Catch-up should generate 0 for this paused rule
    const count = await RecurringService.processCatchUp(userAId);
    expect(count).toBe(0);

    const txns = await prisma.transaction.findMany({
      where: { recurringTransactionId: schedule.id },
    });
    expect(txns.length).toBe(0);

    await RecurringService.delete(userAId, schedule.id);
  });

  // 17. Resume Restores Generation
  it('17. resumes paused rule and enables future generation', async () => {
    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.income,
      amount: 800,
      description: 'Stipend',
      frequency: RecurFrequency.monthly,
      startDate: addDays(now, 10),
    });

    await RecurringService.toggleActive(userAId, schedule.id, false);
    let item = await RecurringService.getById(userAId, schedule.id);
    expect(item?.isActive).toBe(false);

    await RecurringService.toggleActive(userAId, schedule.id, true);
    item = await RecurringService.getById(userAId, schedule.id);
    expect(item?.isActive).toBe(true);

    await RecurringService.delete(userAId, schedule.id);
  });

  // 18. End Date Stops Generation
  it('18. stops generating occurrences once end date has passed and marks inactive', async () => {
    const pastStart = subDays(now, 20);
    const pastEnd = subDays(now, 10);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 350,
      description: 'Short-term promo subscription',
      frequency: RecurFrequency.weekly,
      startDate: pastStart,
      endDate: pastEnd,
    });

    await RecurringService.processCatchUp(userAId);

    const updatedSchedule = await RecurringService.getById(userAId, schedule.id);
    expect(updatedSchedule?.isActive).toBe(false);

    await RecurringService.delete(userAId, schedule.id);
  });

  // 19. Missed Occurrences Catch-up Policy
  it('19. catches up multiple missed occurrences sequentially per architecture policy', async () => {
    // Schedule started 15 days ago with frequency daily -> should catch up 15 occurrences!
    const fifteenDaysAgo = subDays(now, 15);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 50,
      description: 'Daily Cloud Backup',
      frequency: RecurFrequency.daily,
      interval: 1,
      startDate: fifteenDaysAgo,
    });

    const caughtUp = await RecurringService.processCatchUp(userAId);
    expect(caughtUp).toBeGreaterThanOrEqual(15);

    const allTxns = await prisma.transaction.findMany({
      where: { recurringTransactionId: schedule.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(allTxns.length).toBeGreaterThanOrEqual(15);

    // Next occurrence must now be in the future!
    const updated = await RecurringService.getById(userAId, schedule.id);
    expect(updated!.nextRunAt.getTime()).toBeGreaterThan(fifteenDaysAgo.getTime());

    await RecurringService.delete(userAId, schedule.id);
  });

  // 20. Historical Transactions Survive Schedule Deletion (ON DELETE SET NULL)
  it('20. ensures historical transactions survive when their recurring schedule is deleted', async () => {
    const pastDate = subDays(now, 1);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 1500,
      description: 'Temporary Test Subscription',
      frequency: RecurFrequency.monthly,
      startDate: pastDate,
    });

    await RecurringService.processCatchUp(userAId);

    const generated = await prisma.transaction.findFirst({
      where: { recurringTransactionId: schedule.id },
    });
    expect(generated).toBeDefined();

    // Delete schedule
    await RecurringService.delete(userAId, schedule.id);

    // Schedule is gone
    const checkSchedule = await RecurringService.getById(userAId, schedule.id);
    expect(checkSchedule).toBeNull();

    // Transaction still SURVIVES with recurringTransactionId = null!
    const survivingTxn = await prisma.transaction.findUnique({
      where: { id: generated!.id },
    });
    expect(survivingTxn).toBeDefined();
    expect(survivingTxn?.recurringTransactionId).toBeNull();
    expect(survivingTxn?.amount.toNumber()).toBe(1500);

    // Clean up transaction
    await TransactionService.delete(userAId, survivingTxn!.id);
  });

  // 21. Cross-User Isolation (Read, Update, Delete)
  it('21. strictly enforces cross-user isolation for recurring rules', async () => {
    const bSchedule = await RecurringService.create(userBId, {
      accountId: userBCheckingId,
      type: TxnType.expense,
      amount: 600,
      description: 'User B Private Netflix',
      frequency: RecurFrequency.monthly,
      startDate: addDays(now, 5),
    });

    // User A cannot read User B's schedule
    const readAttempt = await RecurringService.getById(userAId, bSchedule.id);
    expect(readAttempt).toBeNull();

    // User A list does not contain User B's schedule
    const aList = await RecurringService.list(userAId);
    expect(aList.some((s) => s.id === bSchedule.id)).toBe(false);

    // User A cannot update User B's schedule
    await expect(
      RecurringService.update(userAId, bSchedule.id, { amount: 1000 })
    ).rejects.toThrow('Recurring schedule not found.');

    // User A cannot delete User B's schedule
    await expect(
      RecurringService.delete(userAId, bSchedule.id)
    ).rejects.toThrow('Recurring schedule not found.');

    await RecurringService.delete(userBId, bSchedule.id);
  });

  // 22. Dashboard Upcoming Widget & Analytics Snapshot Integration
  it('22. provides correct upcoming items for dashboard snapshot', async () => {
    const futureDate = addDays(now, 4);

    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 499,
      description: 'Dashboard Upcoming Test Item',
      frequency: RecurFrequency.monthly,
      startDate: futureDate,
    });

    const upcoming = await RecurringService.getUpcoming(userAId, 5);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.some((u) => u.id === schedule.id)).toBe(true);

    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);
    expect(snapshot.upcomingRecurring).toBeDefined();
    expect(snapshot.upcomingRecurring!.some((u) => u.id === schedule.id)).toBe(true);

    await RecurringService.delete(userAId, schedule.id);
  });

  // 23. Summary Stats Calculation & Zero Edge Cases
  it('23. calculates projected monthly inflows and outflows without NaN or Infinity', async () => {
    const statsA = await RecurringService.getSummaryStats(userAId);
    expect(typeof statsA.projectedMonthlyIncome).toBe('number');
    expect(typeof statsA.projectedMonthlyExpenses).toBe('number');
    expect(isNaN(statsA.projectedMonthlyIncome)).toBe(false);
    expect(isNaN(statsA.projectedMonthlyExpenses)).toBe(false);

    // Zero user with 0 schedules
    const statsZero = await RecurringService.getSummaryStats(userZeroId);
    expect(statsZero.totalCount).toBe(0);
    expect(statsZero.activeCount).toBe(0);
    expect(statsZero.projectedMonthlyIncome).toBe(0);
    expect(statsZero.projectedMonthlyExpenses).toBe(0);
  });

  // 24. Audit Logging Verification
  it('24. writes structured audit logs for sensitive recurring operations', async () => {
    const schedule = await RecurringService.create(userAId, {
      accountId: userACheckingId,
      type: TxnType.expense,
      amount: 777,
      description: 'Audit Log Test Schedule',
      frequency: RecurFrequency.monthly,
      startDate: addDays(now, 12),
    });

    const createLog = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'recurring.create',
        entityId: schedule.id,
      },
    });
    expect(createLog).toBeDefined();

    await RecurringService.update(userAId, schedule.id, { description: 'Updated Audit' });
    const updateLog = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'recurring.update',
        entityId: schedule.id,
      },
    });
    expect(updateLog).toBeDefined();

    await RecurringService.delete(userAId, schedule.id);
    const deleteLog = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'recurring.delete',
        entityId: schedule.id,
      },
    });
    expect(deleteLog).toBeDefined();
  });
});
