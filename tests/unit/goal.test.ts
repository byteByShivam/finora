import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { GoalService } from '@/server/services/goal.service';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { AnalyticsService } from '@/server/services/analytics.service';
import {
  createGoalSchema,
  updateGoalSchema,
  addContributionSchema,
} from '@/lib/validation/goal.schema';
import { AccountType, TxnType, GoalStatus, Prisma } from '@prisma/client';
import { addDays, subDays } from 'date-fns';

describe('Phase 8 — Financial Goals Suite', () => {
  let userAId: string;
  let userBId: string;
  let userZeroId: string;

  let userACheckingId: string;
  let userASavingsId: string;
  let userBCheckingId: string;

  let initialGoalId: string;
  const now = new Date();

  beforeAll(async () => {
    // 1. Clean up old test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'goal-test-a@finora.test',
            'goal-test-b@finora.test',
            'goal-test-zero@finora.test',
          ],
        },
      },
    });

    // 2. Create Users
    const userA = await prisma.user.create({
      data: {
        email: 'goal-test-a@finora.test',
        name: 'Goal Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'goal-test-b@finora.test',
        name: 'Goal Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    const userZero = await prisma.user.create({
      data: {
        email: 'goal-test-zero@finora.test',
        name: 'Goal Tester Zero',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userZeroId = userZero.id;

    // 3. Create Accounts
    const accChecking = await AccountService.create(userAId, {
      name: 'Main Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 100000,
    });
    userACheckingId = accChecking.id;

    const accSavings = await AccountService.create(userAId, {
      name: 'Emergency Savings Account',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 10000,
    });
    userASavingsId = accSavings.id;

    const accB = await AccountService.create(userBId, {
      name: 'User B Checking',
      type: AccountType.bank,
      currency: 'INR',
      openingBalance: 50000,
    });
    userBCheckingId = accB.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'goal-test-a@finora.test',
            'goal-test-b@finora.test',
            'goal-test-zero@finora.test',
          ],
        },
      },
    });
  });

  // Test 1: Create Goal
  it('1. creates a financial goal with valid inputs and audit log', async () => {
    const targetDate = addDays(now, 180);
    const goal = await GoalService.create(userAId, {
      name: 'Emergency Fund',
      description: '6 months of living expenses reserve',
      targetAmount: 60000,
      targetDate,
      accountId: userASavingsId,
      icon: 'Shield',
      color: '#10b981',
    });

    initialGoalId = goal.id;
    expect(goal.id).toBeDefined();
    expect(goal.userId).toBe(userAId);
    expect(goal.name).toBe('Emergency Fund');
    expect(goal.description).toBe('6 months of living expenses reserve');
    expect(goal.targetAmount.toNumber()).toBe(60000);
    expect(goal.currentAmount.toNumber()).toBe(0);
    expect(goal.status).toBe(GoalStatus.active);
    expect(goal.accountId).toBe(userASavingsId);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'goal.create',
        entityId: goal.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.entityType).toBe('goal');
  });

  // Test 2: Reject invalid target amount
  it('2. rejects invalid target amounts (zero, negative, NaN)', () => {
    expect(() => createGoalSchema.parse({ name: 'Car', targetAmount: 0 })).toThrow();
    expect(() => createGoalSchema.parse({ name: 'Car', targetAmount: -5000 })).toThrow();
    expect(() => createGoalSchema.parse({ name: 'Car', targetAmount: NaN })).toThrow();
    expect(() => createGoalSchema.parse({ name: 'Car', targetAmount: Infinity })).toThrow();
  });

  // Test 3: Reject invalid target date
  it('3. rejects invalid target dates', () => {
    expect(() =>
      createGoalSchema.parse({
        name: 'Vacation',
        targetAmount: 50000,
        targetDate: 'invalid-date-string',
      })
    ).toThrow();
  });

  // Test 4: Retrieve user's goals
  it("4. retrieves user's goals with calculated progress and contribution count", async () => {
    const list = await GoalService.list(userAId);
    expect(list.length).toBeGreaterThan(0);

    const found = list.find((g) => g.id === initialGoalId);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Emergency Fund');
    expect(found?.targetAmount).toBe(60000);
    expect(found?.currentAmount).toBe(0);
    expect(found?.remainingAmount).toBe(60000);
    expect(found?.percentage).toBe(0);
    expect(found?.dynamicStatus).toBe('on_track'); // 0 / 60000 on fresh start
    expect(found?.account?.id).toBe(userASavingsId);
  });

  // Test 5 & 9 & 10: Contribution creation and progress update
  it('5, 9, 10. contribution creation records deposit and updates goal progress atomically', async () => {
    const contrib = await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 15000,
      note: 'First monthly savings installment',
      date: now,
    });

    expect(contrib.id).toBeDefined();
    expect(contrib.amount.toNumber()).toBe(15000);
    expect(contrib.note).toBe('First monthly savings installment');

    // Verify goal progress re-derived
    const detail = await GoalService.getById(userAId, initialGoalId);
    expect(detail).not.toBeNull();
    expect(detail?.goal.currentAmount).toBe(15000);
    expect(detail?.goal.remainingAmount).toBe(45000);
    expect(detail?.goal.percentage).toBe(25);
    expect(detail?.goal.contributionCount).toBe(1);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'goal.contribute',
        entityId: initialGoalId,
      },
    });
    expect(audit).not.toBeNull();
  });

  // Test 6 & 7: Calculate remaining amount and percentage progress
  it('6 & 7. calculates remaining amount and percentage progress accurately', async () => {
    // Add second contribution: 15,000 (total = 30,000 / 60,000 = 50%)
    await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 15000,
      note: 'Second installment',
      date: now,
    });

    const detail = await GoalService.getById(userAId, initialGoalId);
    expect(detail?.goal.currentAmount).toBe(30000);
    expect(detail?.goal.remainingAmount).toBe(30000);
    expect(detail?.goal.percentage).toBe(50);
  });

  let thirtyKContribId: string;

  // Test 8: Completed goal state
  it('8. completed goal state marks status as achieved when saved >= target', async () => {
    // Add remaining 30,000 with next day timestamp
    const c = await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 30000,
      note: 'Final payoff deposit',
      date: addDays(now, 1),
    });
    thirtyKContribId = c.id;

    const detail = await GoalService.getById(userAId, initialGoalId);
    expect(detail?.goal.currentAmount).toBe(60000);
    expect(detail?.goal.remainingAmount).toBe(0);
    expect(detail?.goal.percentage).toBe(100);
    expect(detail?.goal.status).toBe(GoalStatus.achieved);
    expect(detail?.goal.dynamicStatus).toBe('completed');
  });

  // Test 11: Contribution deletion reverses progress
  it('11. deleting a contribution reverses its progress atomically', async () => {
    // Delete the 30,000 contribution
    await GoalService.deleteContribution(userAId, initialGoalId, thirtyKContribId);

    const detailAfter = await GoalService.getById(userAId, initialGoalId);
    expect(detailAfter?.goal.currentAmount).toBe(30000);
    expect(detailAfter?.goal.remainingAmount).toBe(30000);
    expect(detailAfter?.goal.percentage).toBe(50);
    expect(detailAfter?.goal.status).toBe(GoalStatus.active);
    expect(detailAfter?.goal.dynamicStatus).not.toBe('completed');
  });

  // Test 12: Multiple contributions aggregate correctly
  it('12. multiple contributions aggregate correctly from contribution ledger', async () => {
    // Current is 30,000 (from two 15,000s). Add 5,000 and 2,500
    await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 5000,
      note: 'Extra savings',
    });
    await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 2500,
      note: 'Coffee budget savings',
    });

    const detail = await GoalService.getById(userAId, initialGoalId);
    expect(detail?.goal.currentAmount).toBe(37500);
    expect(detail?.goal.remainingAmount).toBe(22500);
    expect(detail?.goal.percentage).toBe(62.5);
    expect(detail?.contributions.length).toBe(4);
  });

  // Test 13: Decimal precision preserved without floating-point creep
  it('13. preserves decimal precision for financial calculations without floating-point creep', async () => {
    const precGoal = await GoalService.create(userAId, {
      name: 'Precision Goal',
      targetAmount: 1000.33,
    });

    await GoalService.addContribution(userAId, precGoal.id, {
      goalId: precGoal.id,
      amount: 333.33,
    });
    await GoalService.addContribution(userAId, precGoal.id, {
      goalId: precGoal.id,
      amount: 333.33,
    });

    const detail = await GoalService.getById(userAId, precGoal.id);
    expect(detail?.goal.currentAmount).toBe(666.66);
    expect(detail?.goal.remainingAmount).toBe(333.67);
  });

  // Test 14: Guard against NaN and Infinity
  it('14. guards against divide-by-zero, NaN, and Infinity in summary and metrics', async () => {
    const summary = await GoalService.getSummaryStats(userZeroId);
    expect(Number.isNaN(summary.overallPercentage)).toBe(false);
    expect(Number.isFinite(summary.overallPercentage)).toBe(true);
    expect(summary.overallPercentage).toBe(0);
    expect(summary.totalTarget).toBe(0);
    expect(summary.totalSaved).toBe(0);
  });

  // Test 15: Cross-user goal read rejected
  it('15. cross-user goal read is rejected (returns null)', async () => {
    const detail = await GoalService.getById(userBId, initialGoalId);
    expect(detail).toBeNull();
  });

  // Test 16: Cross-user goal update rejected
  it('16. cross-user goal update is rejected', async () => {
    await expect(
      GoalService.update(userBId, initialGoalId, { name: 'Hacked Goal' })
    ).rejects.toThrow('Goal not found.');
  });

  // Test 17: Cross-user goal delete rejected
  it('17. cross-user goal deletion is rejected', async () => {
    await expect(
      GoalService.delete(userBId, initialGoalId)
    ).rejects.toThrow('Goal not found.');
  });

  // Test 18: Cross-user contribution rejected
  it('18. cross-user contribution is rejected', async () => {
    await expect(
      GoalService.addContribution(userBId, initialGoalId, {
        goalId: initialGoalId,
        amount: 5000,
      })
    ).rejects.toThrow('Goal not found or access denied.');
  });

  // Test 19: Account ownership validation
  it("19. rejects linking another user's account to a goal", async () => {
    await expect(
      GoalService.create(userAId, {
        name: 'Invalid Account Link Goal',
        targetAmount: 10000,
        accountId: userBCheckingId, // Belongs to user B!
      })
    ).rejects.toThrow('Linked account not found or access denied.');
  });

  // Test 20: Dashboard goals integration
  it('20. dashboard snapshot integrates active financial goals', async () => {
    const snapshot = await AnalyticsService.getDashboardSnapshot(userAId);
    expect(snapshot.goals).toBeDefined();
    expect(Array.isArray(snapshot.goals)).toBe(true);
    expect(snapshot.goals.length).toBeGreaterThan(0);

    const goalItem = snapshot.goals.find((g) => g.id === initialGoalId);
    expect(goalItem).toBeDefined();
    expect(goalItem?.name).toBe('Emergency Fund');
    expect(goalItem?.currentAmount).toBe(37500);
    expect(goalItem?.targetAmount).toBe(60000);
  });

  // Test 21: Empty goals state
  it('21. empty goals state returns safe 0 totals without NaN', async () => {
    const list = await GoalService.list(userZeroId);
    expect(list.length).toBe(0);

    const summary = await GoalService.getSummaryStats(userZeroId);
    expect(summary.totalGoalsCount).toBe(0);
    expect(summary.activeGoalsCount).toBe(0);
    expect(summary.completedGoalsCount).toBe(0);
    expect(summary.overallPercentage).toBe(0);
  });

  // Test 22: Overdue goal handling
  it('22. marks goal dynamicStatus as overdue when past deadline with incomplete progress', async () => {
    const pastDate = subDays(now, 5);
    const overdueGoal = await GoalService.create(userAId, {
      name: 'Expired Goal',
      targetAmount: 20000,
      targetDate: pastDate,
    });

    const detail = await GoalService.getById(userAId, overdueGoal.id);
    expect(detail?.goal.dynamicStatus).toBe('overdue');
  });

  // Test 23: Contribution history ordering
  it('23. contribution history is ordered latest first (descending)', async () => {
    const detail = await GoalService.getById(userAId, initialGoalId);
    expect(detail).not.toBeNull();
    const timestamps = detail!.contributions.map((c) => c.createdAt.getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  // Test 24: Atomic contribution mutation
  it('24. goal currentAmount matches sum of contribution ledger exactly', async () => {
    const sumAgg = await prisma.goalContribution.aggregate({
      where: { goalId: initialGoalId },
      _sum: { amount: true },
    });
    const expectedSum = sumAgg._sum.amount?.toNumber() || 0;

    const goal = await prisma.financialGoal.findUnique({
      where: { id: initialGoalId },
    });
    expect(goal?.currentAmount.toNumber()).toBe(expectedSum);
  });

  // Test 25, 26, 27: Financial semantics & transaction-backed transfer contributions
  it('25, 26, 27. transfer-backed goal contribution updates accounts without inflating income or expenses or double-counting net assets', async () => {
    // Check initial snapshot metrics before transfer contribution
    const snapshotBefore = await AnalyticsService.getDashboardSnapshot(userAId);
    const incomeBefore = snapshotBefore.metrics.periodIncome;
    const expenseBefore = snapshotBefore.metrics.periodExpense;
    const netAssetsBefore = snapshotBefore.metrics.totalAssets;

    // Check balances before
    const checkingBefore = (await AccountService.getById(userAId, userACheckingId))?.currentBalance.toNumber() || 0;
    const savingsBefore = (await AccountService.getById(userAId, userASavingsId))?.currentBalance.toNumber() || 0;

    // Contribute ₹10,000 from Main Checking to Emergency Fund (which is linked to Emergency Savings Account)
    const contrib = await GoalService.addContribution(userAId, initialGoalId, {
      goalId: initialGoalId,
      amount: 10000,
      sourceAccountId: userACheckingId,
      note: 'Bank transfer into emergency fund savings',
    });

    expect(contrib.transactionId).toBeDefined();

    // Check balances after
    const checkingAfter = (await AccountService.getById(userAId, userACheckingId))?.currentBalance.toNumber() || 0;
    const savingsAfter = (await AccountService.getById(userAId, userASavingsId))?.currentBalance.toNumber() || 0;

    // Checking decreased by 10,000
    expect(checkingAfter).toBe(checkingBefore - 10000);
    // Savings increased by 10,000
    expect(savingsAfter).toBe(savingsBefore + 10000);

    // Check dashboard snapshot after
    const snapshotAfter = await AnalyticsService.getDashboardSnapshot(userAId);

    // 25. Income NOT inflated
    expect(snapshotAfter.metrics.periodIncome).toBe(incomeBefore);

    // 26. Expense NOT inflated
    expect(snapshotAfter.metrics.periodExpense).toBe(expenseBefore);

    // 27. Total net assets NOT double counted (money moved between accounts, total assets remain identical)
    expect(snapshotAfter.metrics.totalAssets).toBe(netAssetsBefore);
  });

  // Test 28: Contribution update recalculates goal progress
  it('28. contribution update recalculates goal progress and adjusts status', async () => {
    const testGoal = await GoalService.create(userAId, {
      name: 'Laptop Savings',
      targetAmount: 50000,
    });

    const contrib = await GoalService.addContribution(userAId, testGoal.id, {
      goalId: testGoal.id,
      amount: 20000,
      note: 'Initial deposit',
    });

    // Update contribution to 50,000 (hitting target)
    await GoalService.updateContribution(userAId, testGoal.id, contrib.id, {
      id: contrib.id,
      amount: 50000,
      note: 'Upgraded deposit',
    });

    const detail = await GoalService.getById(userAId, testGoal.id);
    expect(detail?.goal.currentAmount).toBe(50000);
    expect(detail?.goal.percentage).toBe(100);
    expect(detail?.goal.status).toBe(GoalStatus.achieved);
  });
});
