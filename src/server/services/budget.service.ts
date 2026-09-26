import prisma from '@/server/db/prisma';
import {
  CreateBudgetInput,
  UpdateBudgetInput,
  UpsertBudgetInput,
} from '@/lib/validation/budget.schema';
import { getPeriodBounds } from '@/lib/dates';
import { Prisma, TxnType, NotifType, BudgetPeriod, CategoryType, Budget } from '@prisma/client';
import { eachDayOfInterval, format } from 'date-fns';

export type BudgetStatus = 'healthy' | 'approaching' | 'critical' | 'exceeded';

export interface BudgetWithProgress {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: BudgetStatus;
  isOverBudget: boolean;
  isWarning: boolean;
  period: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  rolloverEnabled: boolean;
  rolloverAmount: number;
  effectiveBudget: number;
  alertThresholdPct: number;
  transactionCount: number;
}

export interface BudgetSummaryStats {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  budgetCount: number;
  exceededCount: number;
  warningCount: number;
  healthyCount: number;
}

export interface BudgetDetailResult {
  budget: BudgetWithProgress;
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    description: string | null;
    occurredAt: Date;
    account: { id: string; name: string; color: string | null };
  }>;
  spendingTrend: Array<{
    date: string;
    amount: number;
    cumulative: number;
  }>;
}

export class BudgetService {
  /**
   * Helper to derive budget status based on adherence percentage and threshold.
   */
  static getStatus(percentage: number, alertThresholdPct: number): BudgetStatus {
    if (percentage > 100) return 'exceeded';
    if (percentage >= Math.max(alertThresholdPct, 90)) return 'critical';
    if (percentage >= 70) return 'approaching';
    return 'healthy';
  }

  /**
   * Retrieves all budgets for a given period with actual spend calculated from the transaction ledger.
   * Performs a single grouped query across categories to completely avoid N+1 queries.
   */
  static async getForPeriod(
    userId: string,
    periodDate: Date = new Date(),
    period: BudgetPeriod = BudgetPeriod.monthly
  ): Promise<BudgetWithProgress[]> {
    const { start, end } = getPeriodBounds(periodDate, period);

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        period,
        periodStart: {
          gte: start,
          lte: end,
        },
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
      orderBy: { amount: 'desc' },
    });

    if (budgets.length === 0) {
      return [];
    }

    const categoryIds = budgets.map((b) => b.categoryId);

    // Single DB aggregation across all budget categories
    const expenseGrouped = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        categoryId: { in: categoryIds },
        type: TxnType.expense,
        occurredAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const spendMap = new Map<string, { sum: Prisma.Decimal; count: number }>();
    for (const g of expenseGrouped) {
      if (g.categoryId) {
        spendMap.set(g.categoryId, {
          sum: g._sum.amount || new Prisma.Decimal(0),
          count: g._count.id || 0,
        });
      }
    }

    // Process rollover for budgets where enabled
    const rolloverMap = new Map<string, Prisma.Decimal>();
    const rolloverBudgets = budgets.filter((b) => b.rolloverEnabled);

    if (rolloverBudgets.length > 0) {
      const prevDate = new Date(start);
      if (period === BudgetPeriod.yearly) {
        prevDate.setFullYear(prevDate.getFullYear() - 1);
      } else {
        prevDate.setMonth(prevDate.getMonth() - 1);
      }
      const prevBounds = getPeriodBounds(prevDate, period);

      const prevBudgets = await prisma.budget.findMany({
        where: {
          userId,
          categoryId: { in: rolloverBudgets.map((b) => b.categoryId) },
          period,
          periodStart: { gte: prevBounds.start, lte: prevBounds.end },
        },
      });

      if (prevBudgets.length > 0) {
        const prevCategoryIds = prevBudgets.map((b) => b.categoryId);
        const prevExpenses = await prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            userId,
            categoryId: { in: prevCategoryIds },
            type: TxnType.expense,
            occurredAt: { gte: prevBounds.start, lte: prevBounds.end },
          },
          _sum: { amount: true },
        });

        const prevSpendMap = new Map<string, Prisma.Decimal>();
        for (const pe of prevExpenses) {
          if (pe.categoryId) {
            prevSpendMap.set(pe.categoryId, pe._sum.amount || new Prisma.Decimal(0));
          }
        }

        for (const pb of prevBudgets) {
          const spent = prevSpendMap.get(pb.categoryId) || new Prisma.Decimal(0);
          const leftover = pb.amount.sub(spent);
          if (leftover.greaterThan(0)) {
            rolloverMap.set(pb.categoryId, leftover);
          }
        }
      }
    }

    const result: BudgetWithProgress[] = [];

    for (const b of budgets) {
      const spendInfo = spendMap.get(b.categoryId) || {
        sum: new Prisma.Decimal(0),
        count: 0,
      };

      const spentDecimal = spendInfo.sum;
      const budgetDecimal = b.amount;
      const rolloverDecimal = rolloverMap.get(b.categoryId) || new Prisma.Decimal(0);
      const effectiveBudget = budgetDecimal.add(rolloverDecimal);
      const remainingDecimal = effectiveBudget.sub(spentDecimal);

      const spentNum = spentDecimal.toNumber();
      const budgetNum = b.amount.toNumber();
      const effectiveBudgetNum = effectiveBudget.toNumber();
      const remainingNum = remainingDecimal.toNumber();

      let percentage = 0;
      if (effectiveBudget.greaterThan(0)) {
        const rawPct = spentDecimal.div(effectiveBudget).mul(100).toNumber();
        percentage = Math.round(rawPct * 100) / 100;
      }

      const status = BudgetService.getStatus(percentage, b.alertThresholdPct);
      const isOverBudget = status === 'exceeded';
      const isWarning = (status === 'approaching' || status === 'critical' || percentage >= b.alertThresholdPct) && !isOverBudget;

      result.push({
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        categoryIcon: b.category.icon,
        categoryColor: b.category.color,
        amount: budgetNum,
        spent: spentNum,
        remaining: remainingNum,
        percentage,
        status,
        isOverBudget,
        isWarning,
        period: b.period,
        periodStart: b.periodStart,
        periodEnd: end,
        rolloverEnabled: b.rolloverEnabled,
        rolloverAmount: rolloverDecimal.toNumber(),
        effectiveBudget: effectiveBudgetNum,
        alertThresholdPct: b.alertThresholdPct,
        transactionCount: spendInfo.count,
      });
    }

    return result;
  }

  /**
   * Computes aggregate summary statistics across all active budgets for a period.
   */
  static getSummaryStats(budgets: BudgetWithProgress[]): BudgetSummaryStats {
    if (budgets.length === 0) {
      return {
        totalBudgeted: 0,
        totalSpent: 0,
        totalRemaining: 0,
        overallPercentage: 0,
        budgetCount: 0,
        exceededCount: 0,
        warningCount: 0,
        healthyCount: 0,
      };
    }

    const totalBudgetedDec = budgets.reduce((acc, b) => acc.add(new Prisma.Decimal(b.effectiveBudget)), new Prisma.Decimal(0));
    const totalSpentDec = budgets.reduce((acc, b) => acc.add(new Prisma.Decimal(b.spent)), new Prisma.Decimal(0));
    const totalRemainingDec = totalBudgetedDec.sub(totalSpentDec);

    let overallPercentage = 0;
    if (totalBudgetedDec.greaterThan(0)) {
      overallPercentage = Math.round(totalSpentDec.div(totalBudgetedDec).mul(100).toNumber() * 100) / 100;
    }

    const exceededCount = budgets.filter((b) => b.isOverBudget).length;
    const warningCount = budgets.filter((b) => b.isWarning).length;
    const healthyCount = budgets.filter((b) => b.status === 'healthy').length;

    return {
      totalBudgeted: totalBudgetedDec.toNumber(),
      totalSpent: totalSpentDec.toNumber(),
      totalRemaining: totalRemainingDec.toNumber(),
      overallPercentage,
      budgetCount: budgets.length,
      exceededCount,
      warningCount,
      healthyCount,
    };
  }

  /**
   * Retrieves single budget with live progress, related transactions, and daily spending trend.
   */
  static async getById(userId: string, budgetId: string): Promise<BudgetDetailResult | null> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    });

    if (!budget) {
      return null;
    }

    const { start, end } = getPeriodBounds(budget.periodStart, budget.period);

    // Sum actual expenses
    const expenseAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: budget.categoryId,
        type: TxnType.expense,
        occurredAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const spentDecimal = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const budgetDecimal = budget.amount;
    const remainingDecimal = budgetDecimal.sub(spentDecimal);

    const spentNum = spentDecimal.toNumber();
    const budgetNum = budget.amount.toNumber();
    const remainingNum = remainingDecimal.toNumber();

    let percentage = 0;
    if (budgetDecimal.greaterThan(0)) {
      const rawPct = spentDecimal.div(budgetDecimal).mul(100).toNumber();
      percentage = Math.round(rawPct * 100) / 100;
    }

    const status = BudgetService.getStatus(percentage, budget.alertThresholdPct);
    const isOverBudget = status === 'exceeded';
    const isWarning = (status === 'approaching' || status === 'critical' || percentage >= budget.alertThresholdPct) && !isOverBudget;

    const budgetWithProgress: BudgetWithProgress = {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryIcon: budget.category.icon,
      categoryColor: budget.category.color,
      amount: budgetNum,
      spent: spentNum,
      remaining: remainingNum,
      percentage,
      status,
      isOverBudget,
      isWarning,
      period: budget.period,
      periodStart: budget.periodStart,
      periodEnd: end,
      rolloverEnabled: budget.rolloverEnabled,
      rolloverAmount: 0,
      effectiveBudget: budgetNum,
      alertThresholdPct: budget.alertThresholdPct,
      transactionCount: expenseAgg._count.id || 0,
    };

    // Related transactions
    const rawTxns = await prisma.transaction.findMany({
      where: {
        userId,
        categoryId: budget.categoryId,
        type: TxnType.expense,
        occurredAt: { gte: start, lte: end },
      },
      include: {
        account: { select: { id: true, name: true, color: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    const transactions = rawTxns.map((t) => ({
      id: t.id,
      amount: t.amount.toNumber(),
      currency: t.currency,
      description: t.description,
      occurredAt: t.occurredAt,
      account: t.account,
    }));

    // Daily spending trend within period
    const now = new Date();
    const trendEnd = now < end ? now : end;
    const days = eachDayOfInterval({ start, end: trendEnd >= start ? trendEnd : start });

    const dailySpendMap = new Map<string, number>();
    for (const d of days) {
      dailySpendMap.set(format(d, 'yyyy-MM-dd'), 0);
    }

    for (const t of rawTxns) {
      const key = format(t.occurredAt, 'yyyy-MM-dd');
      if (dailySpendMap.has(key)) {
        dailySpendMap.set(key, (dailySpendMap.get(key) || 0) + t.amount.toNumber());
      }
    }

    let runningTotal = 0;
    const spendingTrend = Array.from(dailySpendMap.entries()).map(([dateStr, dailyAmt]) => {
      runningTotal += dailyAmt;
      return {
        date: format(new Date(dateStr), 'dd MMM'),
        amount: Math.round(dailyAmt * 100) / 100,
        cumulative: Math.round(runningTotal * 100) / 100,
      };
    });

    return {
      budget: budgetWithProgress,
      transactions,
      spendingTrend,
    };
  }

  /**
   * Creates a new budget with category ownership validation.
   */
  static async create(userId: string, input: CreateBudgetInput): Promise<Budget> {
    const period = input.period ?? BudgetPeriod.monthly;
    const periodStartDate = input.periodStart ? new Date(input.periodStart) : new Date();
    const { start } = getPeriodBounds(periodStartDate, period);

    // 1. Verify category ownership & type
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new Error('Category not found or unauthorized.');
    }

    if (category.type !== CategoryType.expense) {
      throw new Error('Budgets can only be set for expense categories.');
    }

    // 2. Prevent duplicate budget for same period
    const existing = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId: input.categoryId,
        period,
        periodStart: start,
      },
    });

    if (existing) {
      throw new Error('A budget for this category and period already exists.');
    }

    // 3. Create budget
    const budget = await prisma.budget.create({
      data: {
        userId,
        categoryId: input.categoryId,
        amount: new Prisma.Decimal(input.amount),
        period,
        periodStart: start,
        rolloverEnabled: input.rolloverEnabled ?? false,
        alertThresholdPct: input.alertThresholdPct ?? 80,
      },
    });

    // 4. Audit log entry
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'budget.create',
        entityType: 'budget',
        entityId: budget.id,
        metadata: {
          categoryId: input.categoryId,
          amount: input.amount,
          period,
        },
      },
    });

    return budget;
  }

  /**
   * Updates an existing budget configuration.
   */
  static async update(userId: string, budgetId: string, input: UpdateBudgetInput): Promise<Budget> {
    const existing = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!existing) {
      throw new Error('Budget not found.');
    }

    const updated = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
        ...(input.rolloverEnabled !== undefined ? { rolloverEnabled: input.rolloverEnabled } : {}),
        ...(input.alertThresholdPct !== undefined ? { alertThresholdPct: input.alertThresholdPct } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'budget.update',
        entityType: 'budget',
        entityId: budgetId,
        metadata: {
          previousAmount: existing.amount.toNumber(),
          newAmount: input.amount ?? existing.amount.toNumber(),
        },
      },
    });

    return updated;
  }

  /**
   * Creates or updates a budget entry (upsert) for a category and period.
   */
  static async upsert(userId: string, input: UpsertBudgetInput): Promise<Budget> {
    const period = input.period ?? BudgetPeriod.monthly;
    const periodStartDate = input.periodStart ? new Date(input.periodStart) : new Date();
    const { start } = getPeriodBounds(periodStartDate, period);

    // Verify category exists and is owned or system
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new Error('Category not found or unauthorized.');
    }

    if (category.type !== CategoryType.expense) {
      throw new Error('Budgets can only be set for expense categories.');
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_period_periodStart: {
          userId,
          categoryId: input.categoryId,
          period,
          periodStart: start,
        },
      },
      update: {
        amount: new Prisma.Decimal(input.amount),
        ...(input.rolloverEnabled !== undefined ? { rolloverEnabled: input.rolloverEnabled } : {}),
        ...(input.alertThresholdPct !== undefined ? { alertThresholdPct: input.alertThresholdPct } : {}),
      },
      create: {
        userId,
        categoryId: input.categoryId,
        amount: new Prisma.Decimal(input.amount),
        period,
        periodStart: start,
        rolloverEnabled: input.rolloverEnabled ?? false,
        alertThresholdPct: input.alertThresholdPct ?? 80,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'budget.upsert',
        entityType: 'budget',
        entityId: budget.id,
        metadata: {
          categoryId: input.categoryId,
          amount: input.amount,
          period: input.period,
        },
      },
    });

    return budget;
  }

  /**
   * Deletes a budget entry. NEVER deletes underlying transaction history.
   */
  static async delete(userId: string, budgetId: string): Promise<Budget> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new Error('Budget not found.');
    }

    const deleted = await prisma.budget.delete({
      where: { id: budgetId },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'budget.delete',
        entityType: 'budget',
        entityId: budgetId,
        metadata: {
          categoryId: budget.categoryId,
          amount: budget.amount.toNumber(),
        },
      },
    });

    return deleted;
  }

  /**
   * Checks whether the current spending for a category exceeds its budget threshold
   * and creates an in-app notification if necessary.
   */
  static async checkThresholdAlert(userId: string, categoryId: string, occurredAt: Date = new Date()): Promise<void> {
    const { start, end } = getPeriodBounds(occurredAt, 'monthly');

    const budget = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        period: BudgetPeriod.monthly,
        periodStart: { gte: start, lte: end },
      },
      include: { category: true },
    });

    if (!budget) return;

    const expenseSum = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: TxnType.expense,
        occurredAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const spent = expenseSum._sum.amount || new Prisma.Decimal(0);
    const thresholdAmount = budget.amount.mul(budget.alertThresholdPct).div(100);

    if (spent.greaterThan(budget.amount)) {
      await prisma.notification.create({
        data: {
          userId,
          type: NotifType.budget_exceeded,
          title: `Budget exceeded: ${budget.category.name}`,
          body: `You have spent ${spent.toFixed(2)} out of your ${budget.amount.toFixed(2)} monthly budget.`,
          linkUrl: `/budgets/${budget.id}`,
        },
      });
    } else if (spent.greaterThanOrEqualTo(thresholdAmount)) {
      await prisma.notification.create({
        data: {
          userId,
          type: NotifType.budget_alert,
          title: `Budget alert: ${budget.category.name} reached ${budget.alertThresholdPct}%`,
          body: `You have spent ${spent.toFixed(2)} of your ${budget.amount.toFixed(2)} monthly budget limit.`,
          linkUrl: `/budgets/${budget.id}`,
        },
      });
    }
  }
}
