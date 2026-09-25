import prisma from '@/server/db/prisma';
import { UpsertBudgetInput } from '@/lib/validation/budget.schema';
import { getPeriodBounds } from '@/lib/dates';
import { Prisma, TxnType, NotifType } from '@prisma/client';

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
  period: string;
  periodStart: Date;
  rolloverEnabled: boolean;
  alertThresholdPct: number;
  isOverBudget: boolean;
  isWarning: boolean;
}

export class BudgetService {
  /**
   * Retrieves all budgets for a given period with actual spend calculated from the transaction ledger.
   */
  static async getForPeriod(
    userId: string,
    periodDate: Date = new Date(),
    period: 'monthly' | 'yearly' = 'monthly'
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

    const result: BudgetWithProgress[] = [];

    for (const b of budgets) {
      // Sum actual expense transactions for this category in the period
      const expenseSum = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: b.categoryId,
          type: TxnType.expense,
          occurredAt: {
            gte: start,
            lte: end,
          },
        },
        _sum: { amount: true },
      });

      const spentDecimal = expenseSum._sum.amount || new Prisma.Decimal(0);
      const budgetDecimal = b.amount;

      // Handle rollover if enabled: check previous period's leftover
      let rolloverAmount = new Prisma.Decimal(0);
      if (b.rolloverEnabled) {
        const prevDate = new Date(start);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevBounds = getPeriodBounds(prevDate, period);

        const prevBudget = await prisma.budget.findFirst({
          where: {
            userId,
            categoryId: b.categoryId,
            period,
            periodStart: prevBounds.start,
          },
        });

        if (prevBudget) {
          const prevSpend = await prisma.transaction.aggregate({
            where: {
              userId,
              categoryId: b.categoryId,
              type: TxnType.expense,
              occurredAt: { gte: prevBounds.start, lte: prevBounds.end },
            },
            _sum: { amount: true },
          });
          const prevSpendDec = prevSpend._sum.amount || new Prisma.Decimal(0);
          const leftover = prevBudget.amount.sub(prevSpendDec);
          if (leftover.greaterThan(0)) {
            rolloverAmount = leftover;
          }
        }
      }

      const effectiveBudget = budgetDecimal.add(rolloverAmount);
      const remainingDecimal = effectiveBudget.sub(spentDecimal);

      const spentNum = spentDecimal.toNumber();
      const budgetNum = effectiveBudget.toNumber();
      const remainingNum = remainingDecimal.toNumber();
      const percentage = budgetNum > 0 ? Math.min(Math.round((spentNum / budgetNum) * 100), 100) : 0;
      const isOverBudget = spentNum > budgetNum;
      const isWarning = percentage >= b.alertThresholdPct && !isOverBudget;

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
        period: b.period,
        periodStart: b.periodStart,
        rolloverEnabled: b.rolloverEnabled,
        alertThresholdPct: b.alertThresholdPct,
        isOverBudget,
        isWarning,
      });
    }

    return result;
  }

  /**
   * Creates or updates a budget entry for a category and period.
   */
  static async upsert(userId: string, input: UpsertBudgetInput) {
    const { start } = getPeriodBounds(new Date(input.periodStart), input.period);

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new Error('Category not found.');
    }

    return prisma.budget.upsert({
      where: {
        userId_categoryId_period_periodStart: {
          userId,
          categoryId: input.categoryId,
          period: input.period,
          periodStart: start,
        },
      },
      update: {
        amount: new Prisma.Decimal(input.amount),
        rolloverEnabled: input.rolloverEnabled,
        alertThresholdPct: input.alertThresholdPct,
      },
      create: {
        userId,
        categoryId: input.categoryId,
        amount: new Prisma.Decimal(input.amount),
        period: input.period,
        periodStart: start,
        rolloverEnabled: input.rolloverEnabled,
        alertThresholdPct: input.alertThresholdPct,
      },
    });
  }

  /**
   * Deletes a budget entry.
   */
  static async delete(userId: string, budgetId: string) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new Error('Budget not found.');
    }

    return prisma.budget.delete({
      where: { id: budgetId },
    });
  }

  /**
   * Checks whether the current spending for a category exceeds its budget threshold
   * and creates an in-app notification if necessary.
   */
  static async checkThresholdAlert(userId: string, categoryId: string, occurredAt: Date = new Date()) {
    const { start, end } = getPeriodBounds(occurredAt, 'monthly');

    const budget = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        period: 'monthly',
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

    if (spent.greaterThanOrEqualTo(budget.amount)) {
      // Over budget notification
      await prisma.notification.create({
        data: {
          userId,
          type: NotifType.budget_exceeded,
          title: `Budget exceeded: ${budget.category.name}`,
          body: `You have spent Rs. ${spent.toFixed(2)} out of your Rs. ${budget.amount.toFixed(2)} budget.`,
          linkUrl: '/budgets',
        },
      });
    } else if (spent.greaterThanOrEqualTo(thresholdAmount)) {
      // Threshold warning
      await prisma.notification.create({
        data: {
          userId,
          type: NotifType.budget_alert,
          title: `Budget alert: ${budget.category.name} reached ${budget.alertThresholdPct}%`,
          body: `You have spent Rs. ${spent.toFixed(2)} of your Rs. ${budget.amount.toFixed(2)} monthly limit.`,
          linkUrl: '/budgets',
        },
      });
    }
  }
}
