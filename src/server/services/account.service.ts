import prisma from '@/server/db/prisma';
import { CreateAccountInput, UpdateAccountInput } from '@/lib/validation/account.schema';
import { Prisma, TxnType } from '@prisma/client';

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
   * Lists all accounts owned by the user.
   */
  static async list(userId: string) {
    return prisma.account.findMany({
      where: { userId },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieves a single account owned by user.
   */
  static async getById(userId: string, accountId: string) {
    return prisma.account.findFirst({
      where: { id: accountId, userId },
    });
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

    const opening = new Prisma.Decimal(input.openingBalance);

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
