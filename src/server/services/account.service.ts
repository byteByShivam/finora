import prisma from '@/server/db/prisma';
import { CreateAccountInput, UpdateAccountInput } from '@/lib/validation/account.schema';
import { Prisma, TxnType, AccountType, Account } from '@prisma/client';

export interface AccountDetailStats {
  openingBalance: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
  totalIncome: Prisma.Decimal;
  totalExpense: Prisma.Decimal;
  totalTransferIn: Prisma.Decimal;
  totalTransferOut: Prisma.Decimal;
  totalInflows: Prisma.Decimal;
  totalOutflows: Prisma.Decimal;
  netChange: Prisma.Decimal;
  transactionCount: number;
  creditUtilizationPct: number | null;
}

export interface AccountDetailResult {
  account: Account;
  stats: AccountDetailStats;
  recentTransactions: Array<{
    id: string;
    userId: string;
    accountId: string;
    transferAccountId: string | null;
    categoryId: string | null;
    type: TxnType;
    amount: Prisma.Decimal;
    currency: string;
    description: string | null;
    notes: string | null;
    occurredAt: Date;
    isReconciled: boolean;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
    transferAccount: {
      id: string;
      name: string;
      color: string | null;
    } | null;
    account: {
      id: string;
      name: string;
    };
  }>;
}

export class AccountService {
  /**
   * Recalculates and updates the cached currentBalance for an account
   * using application-level transactional aggregation.
   */
  static async recomputeBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string
  ): Promise<Prisma.Decimal> {
    const account = await tx.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true, openingBalance: true },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Income
    const incomeAgg = await tx.transaction.aggregate({
      where: { userId, accountId, type: TxnType.income },
      _sum: { amount: true },
    });

    // Expense
    const expenseAgg = await tx.transaction.aggregate({
      where: { userId, accountId, type: TxnType.expense },
      _sum: { amount: true },
    });

    // Outbound transfers
    const transferOutAgg = await tx.transaction.aggregate({
      where: { userId, accountId, type: TxnType.transfer },
      _sum: { amount: true },
    });

    // Inbound transfers
    const transferInAgg = await tx.transaction.aggregate({
      where: { userId, transferAccountId: accountId, type: TxnType.transfer },
      _sum: { amount: true },
    });

    const income = incomeAgg._sum.amount || new Prisma.Decimal(0);
    const expense = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const xferOut = transferOutAgg._sum.amount || new Prisma.Decimal(0);
    const xferIn = transferInAgg._sum.amount || new Prisma.Decimal(0);

    const newBalance = account.openingBalance
      .add(income)
      .sub(expense)
      .sub(xferOut)
      .add(xferIn);

    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: newBalance },
    });

    return newBalance;
  }

  /**
   * Lists accounts owned by the user, with optional filters and transaction counts.
   */
  static async list(
    userId: string,
    filters?: {
      type?: AccountType;
      isArchived?: boolean;
      search?: string;
    }
  ) {
    return prisma.account.findMany({
      where: {
        userId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.isArchived !== undefined && { isArchived: filters.isArchived }),
        ...(filters?.search && {
          name: {
            contains: filters.search,
            mode: 'insensitive',
          },
        }),
      },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieves a single account owned by user.
   */
  static async getById(userId: string, accountId: string) {
    return prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves comprehensive account details including server-computed
   * financial statistics and recent transactions.
   */
  static async getAccountDetail(userId: string, accountId: string): Promise<AccountDetailResult | null> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return null;
    }

    // Income
    const incomeAgg = await prisma.transaction.aggregate({
      where: { userId, accountId, type: TxnType.income },
      _sum: { amount: true },
    });

    // Expense
    const expenseAgg = await prisma.transaction.aggregate({
      where: { userId, accountId, type: TxnType.expense },
      _sum: { amount: true },
    });

    // Outbound transfers
    const transferOutAgg = await prisma.transaction.aggregate({
      where: { userId, accountId, type: TxnType.transfer },
      _sum: { amount: true },
    });

    // Inbound transfers
    const transferInAgg = await prisma.transaction.aggregate({
      where: { userId, transferAccountId: accountId, type: TxnType.transfer },
      _sum: { amount: true },
    });

    const totalIncome = incomeAgg._sum.amount || new Prisma.Decimal(0);
    const totalExpense = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const totalTransferOut = transferOutAgg._sum.amount || new Prisma.Decimal(0);
    const totalTransferIn = transferInAgg._sum.amount || new Prisma.Decimal(0);

    const totalInflows = totalIncome.add(totalTransferIn);
    const totalOutflows = totalExpense.add(totalTransferOut);
    const netChange = totalInflows.sub(totalOutflows);

    const transactionCount = await prisma.transaction.count({
      where: {
        userId,
        OR: [{ accountId }, { transferAccountId: accountId }],
      },
    });

    let creditUtilizationPct: number | null = null;
    if (account.type === AccountType.credit_card && account.creditLimit && account.creditLimit.greaterThan(0)) {
      const pct = account.currentBalance.div(account.creditLimit).mul(100).toNumber();
      creditUtilizationPct = Math.min(Math.max(pct, 0), 100);
    }

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [{ accountId }, { transferAccountId: accountId }],
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        transferAccount: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      account,
      stats: {
        openingBalance: account.openingBalance,
        currentBalance: account.currentBalance,
        totalIncome,
        totalExpense,
        totalTransferIn,
        totalTransferOut,
        totalInflows,
        totalOutflows,
        netChange,
        transactionCount,
        creditUtilizationPct,
      },
      recentTransactions,
    };
  }

  /**
   * Creates a new account.
   */
  static async create(userId: string, input: CreateAccountInput) {
    const existing = await prisma.account.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });

    if (existing) {
      throw new Error(`An account named "${input.name}" already exists.`);
    }

    const opening = new Prisma.Decimal(input.openingBalance ?? 0);

    return prisma.account.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        currency: input.currency || 'INR',
        openingBalance: opening,
        currentBalance: opening,
        color: input.color || null,
        icon: input.icon || null,
        creditLimit: input.creditLimit ? new Prisma.Decimal(input.creditLimit) : null,
      },
    });
  }

  /**
   * Updates account details.
   */
  static async update(userId: string, accountId: string, input: UpdateAccountInput) {
    const account = await this.getById(userId, accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (input.name && input.name !== account.name) {
      const existing = await prisma.account.findUnique({
        where: { userId_name: { userId, name: input.name } },
      });
      if (existing) {
        throw new Error(`An account named "${input.name}" already exists.`);
      }
    }

    return prisma.account.update({
      where: { id: accountId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.creditLimit !== undefined && {
          creditLimit: input.creditLimit ? new Prisma.Decimal(input.creditLimit) : null,
        }),
      },
    });
  }

  /**
   * Toggles archive status of an account.
   */
  static async toggleArchive(userId: string, accountId: string, isArchived: boolean) {
    const account = await this.getById(userId, accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return prisma.account.update({
      where: { id: accountId },
      data: { isArchived },
    });
  }

  /**
   * Deletes an account only if it has zero transactions.
   * If transactions exist, DB RESTRICT blocks deletion and prompts archiving instead.
   */
  static async delete(userId: string, accountId: string) {
    const account = await this.getById(userId, accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const txnCount = await prisma.transaction.count({
      where: {
        userId,
        OR: [{ accountId }, { transferAccountId: accountId }],
      },
    });

    if (txnCount > 0) {
      throw new Error(
        `Cannot delete account "${account.name}" because it contains ${txnCount} transaction(s). Please archive it instead.`
      );
    }

    return prisma.account.delete({
      where: { id: accountId },
    });
  }
}
