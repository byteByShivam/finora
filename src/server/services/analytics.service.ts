import prisma from '@/server/db/prisma';
import {
  getDashboardPeriodRange,
  DashboardPeriod,
  formatDate,
} from '@/lib/dates';
import { calculatePercentage } from '@/lib/money';
import { Prisma, TxnType, AccountType, BudgetPeriod } from '@prisma/client';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
} from 'date-fns';

export interface DashboardMetrics {
  totalBalance: number;
  totalAssets: number;
  totalCreditDebt: number;
  periodIncome: number;
  periodExpense: number;
  netCashFlow: number;
  savingsRate: number;
  activeAccountCount: number;
  transactionCount: number;
}

export interface DashboardAccountItem {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  openingBalance: number;
  creditLimit: number | null;
  allocationPercentage: number;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
}

export interface DashboardCategoryBreakdown {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  amount: number;
  percentage: number;
}

export interface DashboardTrendPoint {
  date: string;
  income: number;
  expense: number;
  netCashFlow: number;
}

export interface DashboardRecentTransaction {
  id: string;
  type: TxnType;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  occurredAt: string;
  accountName: string;
  accountColor: string | null;
  transferAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

import { BudgetService } from '@/server/services/budget.service';
import { GoalService } from '@/server/services/goal.service';
import { RecurringService, UpcomingRecurringItem } from '@/server/services/recurring.service';

export type DashboardRecurringItem = UpcomingRecurringItem;

export interface DashboardBudgetItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: string;
  isOverBudget: boolean;
}

export interface DashboardGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentage: number;
  targetDate: string | null;
  status: string;
  icon: string | null;
  color: string | null;
}

export interface DashboardSnapshot {
  period: {
    key: DashboardPeriod;
    label: string;
    from: string;
    to: string;
  };
  metrics: DashboardMetrics;
  accounts: DashboardAccountItem[];
  categoryBreakdown: DashboardCategoryBreakdown[];
  cashFlowTrend: DashboardTrendPoint[];
  recentTransactions: DashboardRecentTransaction[];
  budgets: DashboardBudgetItem[];
  goals: DashboardGoalItem[];
  upcomingRecurring?: DashboardRecurringItem[];
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasPeriodActivity: boolean;
}

export interface DashboardFilterOptions {
  period?: DashboardPeriod | string;
  from?: string | Date;
  to?: string | Date;
}

export class AnalyticsService {
  /**
   * Generates a coherent, database-backed DashboardSnapshot DTO for the user.
   * All aggregations and math are performed in the server service layer using Prisma.Decimal.
   */
  static async getDashboardSnapshot(
    userId: string,
    options: DashboardFilterOptions = {}
  ): Promise<DashboardSnapshot> {
    const range = getDashboardPeriodRange(options.period || 'this_month', options.from, options.to);
    const { from, to, label, period: periodKey } = range;

    // 1. User Accounts (Active & Archived)
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ isArchived: 'asc' }, { currentBalance: 'desc' }],
    });

    const activeAccounts = userAccounts.filter((a) => !a.isArchived);

    let totalAssetsDec = new Prisma.Decimal(0);
    let totalCreditDebtDec = new Prisma.Decimal(0);

    for (const acc of activeAccounts) {
      if (acc.type === AccountType.credit_card) {
        // In the ledger, credit card spending results in a negative balance (or positive liability).
        const cardDebt = acc.currentBalance.isNegative()
          ? acc.currentBalance.abs()
          : acc.currentBalance;
        totalCreditDebtDec = totalCreditDebtDec.add(cardDebt);
      } else {
        totalAssetsDec = totalAssetsDec.add(acc.currentBalance);
      }
    }

    const totalNetBalanceDec = totalAssetsDec.sub(totalCreditDebtDec);

    const accountList: DashboardAccountItem[] = activeAccounts.map((a) => {
      const balNum = a.currentBalance.toNumber();
      let allocationPercentage = 0;

      if (a.type !== AccountType.credit_card && totalAssetsDec.greaterThan(0)) {
        allocationPercentage = calculatePercentage(a.currentBalance, totalAssetsDec);
      } else if (a.type === AccountType.credit_card && a.creditLimit && a.creditLimit.greaterThan(0)) {
        allocationPercentage = calculatePercentage(a.currentBalance.abs(), a.creditLimit);
      }

      return {
        id: a.id,
        name: a.name,
        type: a.type,
        currentBalance: balNum,
        openingBalance: a.openingBalance.toNumber(),
        creditLimit: a.creditLimit ? a.creditLimit.toNumber() : null,
        allocationPercentage,
        color: a.color,
        icon: a.icon,
        isArchived: a.isArchived,
      };
    });

    // 2. Period Financial Metrics (Income, Expense, Cash Flow)
    const [incomeAgg, expenseAgg, periodTxnCount, totalAllTimeTxnCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TxnType.income,
          occurredAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: TxnType.expense,
          occurredAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          userId,
          occurredAt: { gte: from, lte: to },
        },
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    const incomeDec = incomeAgg._sum.amount || new Prisma.Decimal(0);
    const expenseDec = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const netCashFlowDec = incomeDec.sub(expenseDec);

    let savingsRate = 0;
    if (incomeDec.greaterThan(0)) {
      savingsRate = calculatePercentage(netCashFlowDec, incomeDec);
    }

    // 3. Category Breakdown for Period Expenses
    const categoryExpenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: TxnType.expense,
        occurredAt: { gte: from, lte: to },
      },
      select: {
        amount: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    const catTotalsMap = new Map<
      string,
      { id: string; name: string; color: string; icon: string | null; total: Prisma.Decimal }
    >();

    for (const txn of categoryExpenses) {
      const catId = txn.category?.id || 'uncategorized';
      const catName = txn.category?.name || 'Uncategorized';
      const catColor = txn.category?.color || '#94a3b8';
      const catIcon = txn.category?.icon || null;

      const current = catTotalsMap.get(catId) || {
        id: catId,
        name: catName,
        color: catColor,
        icon: catIcon,
        total: new Prisma.Decimal(0),
      };
      current.total = current.total.add(txn.amount);
      catTotalsMap.set(catId, current);
    }

    const categoryBreakdown: DashboardCategoryBreakdown[] = Array.from(catTotalsMap.values())
      .map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        icon: item.icon,
        amount: item.total.toNumber(),
        percentage: expenseDec.greaterThan(0) ? calculatePercentage(item.total, expenseDec) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 4. Cash Flow & Income vs Expense Trend (Time-Bucket Aggregation)
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const isDaily = diffDays <= 35;

    const trendPointsMap = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();

    if (isDaily) {
      const days = eachDayOfInterval({ start: from, end: to });
      for (const d of days) {
        const key = format(d, 'yyyy-MM-dd');
        trendPointsMap.set(key, {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
        });
      }
    } else {
      const months = eachMonthOfInterval({ start: from, end: to });
      for (const m of months) {
        const key = format(m, 'yyyy-MM');
        trendPointsMap.set(key, {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
        });
      }
    }

    const trendTxns = await prisma.transaction.findMany({
      where: {
        userId,
        type: { in: [TxnType.income, TxnType.expense] },
        occurredAt: { gte: from, lte: to },
      },
      select: {
        type: true,
        amount: true,
        occurredAt: true,
      },
    });

    for (const t of trendTxns) {
      const key = isDaily ? format(t.occurredAt, 'yyyy-MM-dd') : format(t.occurredAt, 'yyyy-MM');
      const point = trendPointsMap.get(key);
      if (point) {
        if (t.type === TxnType.income) {
          point.income = point.income.add(t.amount);
        } else if (t.type === TxnType.expense) {
          point.expense = point.expense.add(t.amount);
        }
      }
    }

    const cashFlowTrend: DashboardTrendPoint[] = Array.from(trendPointsMap.entries()).map(
      ([key, val]) => {
        const dateLabel = isDaily
          ? format(new Date(key), 'dd MMM')
          : format(new Date(`${key}-01`), 'MMM yyyy');

        const incNum = val.income.toNumber();
        const expNum = val.expense.toNumber();
        const netNum = val.income.sub(val.expense).toNumber();

        return {
          date: dateLabel,
          income: incNum,
          expense: expNum,
          netCashFlow: netNum,
        };
      }
    );

    // 5. Recent Transactions Widget (Latest 6 transactions across all types)
    const recentTxnsRaw = await prisma.transaction.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        transferAccount: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 6,
    });

    const recentTransactions: DashboardRecentTransaction[] = recentTxnsRaw.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      currency: t.currency,
      description: t.description,
      notes: t.notes,
      occurredAt: t.occurredAt.toISOString(),
      accountName: t.account.name,
      accountColor: t.account.color,
      transferAccountName: t.transferAccount ? t.transferAccount.name : null,
      categoryName: t.category ? t.category.name : null,
      categoryColor: t.category ? t.category.color : null,
      categoryIcon: t.category ? t.category.icon : null,
    }));

    // 6. Active Budgets Overview
    const budgetsRaw = await BudgetService.getForPeriod(userId, from, BudgetPeriod.monthly);
    const budgets: DashboardBudgetItem[] = budgetsRaw.slice(0, 4).map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      categoryColor: b.categoryColor,
      categoryIcon: b.categoryIcon,
      amount: b.amount,
      spent: b.spent,
      remaining: b.remaining,
      percentage: b.percentage,
      status: b.status,
      isOverBudget: b.isOverBudget,
    }));

    // 7. Active Financial Goals
    const goals: DashboardGoalItem[] = await GoalService.getActiveGoalsForDashboard(userId, 4);

    // 8. Upcoming Recurring Transactions
    const upcomingRecurring: DashboardRecurringItem[] = await RecurringService.getUpcoming(userId, 5);

    return {
      period: {
        key: periodKey,
        label,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      metrics: {
        totalBalance: totalNetBalanceDec.toNumber(),
        totalAssets: totalAssetsDec.toNumber(),
        totalCreditDebt: totalCreditDebtDec.toNumber(),
        periodIncome: incomeDec.toNumber(),
        periodExpense: expenseDec.toNumber(),
        netCashFlow: netCashFlowDec.toNumber(),
        savingsRate,
        activeAccountCount: activeAccounts.length,
        transactionCount: periodTxnCount,
      },
      accounts: accountList,
      categoryBreakdown,
      cashFlowTrend,
      recentTransactions,
      budgets,
      goals,
      upcomingRecurring,
      hasAccounts: userAccounts.length > 0,
      hasTransactions: totalAllTimeTxnCount > 0,
      hasPeriodActivity: periodTxnCount > 0,
    };
  }

  /**
   * Deep annual analytics breakdown for the /analytics page.
   */
  static async getAnalytics(userId: string, year: number = new Date().getFullYear()) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const yearTxns = await prisma.transaction.findMany({
      where: {
        userId,
        occurredAt: { gte: startOfYear, lte: endOfYear },
      },
      include: { category: true, account: true },
      orderBy: { occurredAt: 'asc' },
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySeries = monthNames.map((name) => ({
      month: name,
      income: 0,
      expense: 0,
      net: 0,
    }));

    let totalYearIncome = new Prisma.Decimal(0);
    let totalYearExpense = new Prisma.Decimal(0);
    const catMap = new Map<string, { name: string; color: string; amount: Prisma.Decimal }>();

    for (const t of yearTxns) {
      const mIdx = t.occurredAt.getMonth();
      const amtNum = t.amount.toNumber();

      if (t.type === TxnType.income) {
        monthlySeries[mIdx].income += amtNum;
        monthlySeries[mIdx].net += amtNum;
        totalYearIncome = totalYearIncome.add(t.amount);
      } else if (t.type === TxnType.expense) {
        monthlySeries[mIdx].expense += amtNum;
        monthlySeries[mIdx].net -= amtNum;
        totalYearExpense = totalYearExpense.add(t.amount);

        if (t.category) {
          const cur = catMap.get(t.category.id) || {
            name: t.category.name,
            color: t.category.color || '#64748b',
            amount: new Prisma.Decimal(0),
          };
          cur.amount = cur.amount.add(t.amount);
          catMap.set(t.category.id, cur);
        }
      }
    }

    const categories = Array.from(catMap.values())
      .map((c) => ({
        name: c.name,
        color: c.color,
        amount: c.amount.toNumber(),
        percentage: totalYearExpense.greaterThan(0)
          ? Math.round(c.amount.div(totalYearExpense).mul(100).toNumber())
          : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
    });

    const accountDistribution = accounts.map((a) => ({
      name: a.name,
      balance: a.currentBalance.toNumber(),
      color: a.color || '#3b82f6',
    }));

    return {
      year,
      totalIncome: totalYearIncome.toNumber(),
      totalExpense: totalYearExpense.toNumber(),
      netSavings: totalYearIncome.sub(totalYearExpense).toNumber(),
      monthlySeries,
      categories,
      accountDistribution,
    };
  }
}

