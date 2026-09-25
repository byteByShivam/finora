import prisma from '@/server/db/prisma';
import { getPeriodBounds, getPreviousMonthBounds } from '@/lib/dates';
import { BudgetService, BudgetWithProgress } from './budget.service';
import { GoalService } from './goal.service';
import { Prisma, TxnType, AccountType } from '@prisma/client';

export interface DashboardSnapshot {
  period: {
    from: Date;
    to: Date;
  };
  metrics: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    netSavings: number;
    savingsRate: number; // percentage 0-100
  };
  accounts: {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
    color: string | null;
    icon: string | null;
  }[];
  recentTransactions: {
    id: string;
    description: string | null;
    amount: number;
    type: TxnType;
    categoryName: string | null;
    categoryColor: string | null;
    categoryIcon: string | null;
    accountName: string;
    occurredAt: Date;
  }[];
  categoryBreakdown: {
    id: string;
    name: string;
    color: string;
    amount: number;
    percentage: number;
  }[];
  spendingTrend: {
    date: string;
    income: number;
    expense: number;
  }[];
  budgets: BudgetWithProgress[];
  goals: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    percentage: number;
    remaining: number;
    targetDate: Date | null;
    color: string | null;
    icon: string | null;
  }[];
  unreadNotificationsCount: number;
}

export class AnalyticsService {
  /**
   * Generates a single, coherent DashboardSnapshot DTO for the user.
   * All aggregations are performed on the server.
   */
  static async getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
    const { start: from, end: to } = getPeriodBounds(new Date(), 'monthly');

    // 1. Accounts & Total Net Worth / Balance
    const userAccounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      orderBy: { currentBalance: 'desc' },
    });

    let totalBalanceDec = new Prisma.Decimal(0);
    const accountList = userAccounts.map((a) => {
      const balNum = a.currentBalance.toNumber();
      // In net worth, credit cards count as liabilities (negative contribution)
      if (a.type === AccountType.credit_card) {
        totalBalanceDec = totalBalanceDec.sub(a.currentBalance);
      } else {
        totalBalanceDec = totalBalanceDec.add(a.currentBalance);
      }
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        balance: balNum,
        color: a.color,
        icon: a.icon,
      };
    });

    // 2. Current Month Income and Expense
    const incomeAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: TxnType.income,
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const expenseAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: TxnType.expense,
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const incomeDec = incomeAgg._sum.amount || new Prisma.Decimal(0);
    const expenseDec = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const savingsDec = incomeDec.sub(expenseDec);

    let savingsRate = 0;
    if (incomeDec.greaterThan(0)) {
      const rate = savingsDec.div(incomeDec).mul(100).toNumber();
      savingsRate = Math.min(Math.max(Math.round(rate), -100), 100);
    }

    // 3. Category Breakdown for current month expenses
    const categoryExpenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: TxnType.expense,
        occurredAt: { gte: from, lte: to },
        categoryId: { not: null },
      },
      include: { category: true },
    });

    const catTotalsMap = new Map<string, { name: string; color: string; total: Prisma.Decimal }>();
    for (const txn of categoryExpenses) {
      if (!txn.category) continue;
      const cur = catTotalsMap.get(txn.category.id) || {
        name: txn.category.name,
        color: txn.category.color || '#64748b',
        total: new Prisma.Decimal(0),
      };
      cur.total = cur.total.add(txn.amount);
      catTotalsMap.set(txn.category.id, cur);
    }

    const catBreakdown = Array.from(catTotalsMap.entries())
      .map(([id, item]) => {
        const amt = item.total.toNumber();
        const pct = expenseDec.greaterThan(0)
          ? Math.round(item.total.div(expenseDec).mul(100).toNumber())
          : 0;
        return {
          id,
          name: item.name,
          color: item.color,
          amount: amt,
          percentage: pct,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // 4. Daily Spending Trend for current month
    const monthTxns = await prisma.transaction.findMany({
      where: {
        userId,
        occurredAt: { gte: from, lte: to },
        type: { in: [TxnType.income, TxnType.expense] },
      },
      select: {
        type: true,
        amount: true,
        occurredAt: true,
      },
    });

    const trendDaysMap = new Map<string, { income: number; expense: number }>();
    const totalDays = to.getDate();
    for (let d = 1; d <= totalDays; d++) {
      const dayKey = `${d.toString().padStart(2, '0')}`;
      trendDaysMap.set(dayKey, { income: 0, expense: 0 });
    }

    for (const t of monthTxns) {
      const dayKey = `${t.occurredAt.getDate().toString().padStart(2, '0')}`;
      const entry = trendDaysMap.get(dayKey);
      if (entry) {
        if (t.type === TxnType.income) {
          entry.income += t.amount.toNumber();
        } else if (t.type === TxnType.expense) {
          entry.expense += t.amount.toNumber();
        }
      }
    }

    const spendingTrend = Array.from(trendDaysMap.entries()).map(([day, val]) => ({
      date: `Day ${day}`,
      income: val.income,
      expense: val.expense,
    }));

    // 5. Recent 6 Transactions
    const recentTxnsRaw = await prisma.transaction.findMany({
      where: { userId },
      include: {
        category: true,
        account: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 6,
    });

    const recentTransactions = recentTxnsRaw.map((t) => ({
      id: t.id,
      description: t.description || (t.type === TxnType.transfer ? 'Transfer' : t.category?.name || 'Uncategorized'),
      amount: t.amount.toNumber(),
      type: t.type,
      categoryName: t.category?.name || null,
      categoryColor: t.category?.color || null,
      categoryIcon: t.category?.icon || null,
      accountName: t.account.name,
      occurredAt: t.occurredAt,
    }));

    // 6. Budgets with actual spend
    const budgets = await BudgetService.getForPeriod(userId, from, 'monthly');

    // 7. Goals with progress
    const goalsRaw = await GoalService.list(userId);
    const goals = goalsRaw.slice(0, 3).map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmountNum,
      currentAmount: g.currentAmountNum,
      percentage: g.percentage,
      remaining: g.remaining,
      targetDate: g.targetDate,
      color: g.color,
      icon: g.icon,
    }));

    // 8. Notifications unread
    const unreadNotificationsCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      period: { from, to },
      metrics: {
        totalBalance: totalBalanceDec.toNumber(),
        monthlyIncome: incomeDec.toNumber(),
        monthlyExpense: expenseDec.toNumber(),
        netSavings: savingsDec.toNumber(),
        savingsRate,
      },
      accounts: accountList,
      recentTransactions,
      categoryBreakdown: catBreakdown,
      spendingTrend,
      budgets,
      goals,
      unreadNotificationsCount,
    };
  }

  /**
   * Deep analytics breakdown for the /analytics page.
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

    // Monthly totals (12 months)
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

    // Account distribution
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
