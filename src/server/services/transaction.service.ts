import prisma from '@/server/db/prisma';
import { CreateTransactionInput, UpdateTransactionInput, TransactionFilterInput } from '@/lib/validation/transaction.schema';
import { AccountService } from './account.service';
import { Prisma, TxnType } from '@prisma/client';

export class TransactionService {
  /**
   * Creates a transaction, updates the affected account balances,
   * and verifies user ownership in an application-level transaction.
   */
  static async create(userId: string, input: CreateTransactionInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify source account ownership
      const sourceAccount = await tx.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!sourceAccount) {
        throw new Error('Source account not found or not owned by user.');
      }

      // 2. Transfer verification
      if (input.type === TxnType.transfer) {
        if (!input.transferAccountId) {
          throw new Error('Destination account is required for transfers.');
        }
        if (input.transferAccountId === input.accountId) {
          throw new Error('Source and destination accounts cannot be identical.');
        }

        const destAccount = await tx.account.findFirst({
          where: { id: input.transferAccountId, userId },
        });
        if (!destAccount) {
          throw new Error('Destination account not found or not owned by user.');
        }
      }

      // 3. Category verification (if provided)
      if (input.categoryId) {
        const category = await tx.category.findFirst({
          where: {
            id: input.categoryId,
            OR: [{ userId: null }, { userId }],
          },
        });
        if (!category) {
          throw new Error('Category not found.');
        }
      }

      // 4. Create transaction row
      const txn = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          transferAccountId: input.type === TxnType.transfer ? input.transferAccountId : null,
          categoryId: input.type === TxnType.transfer ? null : input.categoryId,
          type: input.type,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency || sourceAccount.currency,
          description: input.description || null,
          notes: input.notes || null,
          occurredAt: input.occurredAt || new Date(),
        },
      });

      // 5. Recompute source account balance
      await AccountService.recomputeBalance(tx, userId, input.accountId);

      // 6. Recompute destination account balance if transfer
      if (input.type === TxnType.transfer && input.transferAccountId) {
        await AccountService.recomputeBalance(tx, userId, input.transferAccountId);
      }

      return txn;
    });
  }

  /**
   * Updates an existing transaction and updates all affected account balances.
   */
  static async update(userId: string, transactionId: string, input: UpdateTransactionInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify existence and ownership
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });
      if (!existing) {
        throw new Error('Transaction not found.');
      }

      const affectedAccountIds = new Set<string>([existing.accountId]);
      if (existing.transferAccountId) {
        affectedAccountIds.add(existing.transferAccountId);
      }

      // If new account provided, check ownership
      if (input.accountId && input.accountId !== existing.accountId) {
        const newAcc = await tx.account.findFirst({
          where: { id: input.accountId, userId },
        });
        if (!newAcc) throw new Error('Account not found.');
        affectedAccountIds.add(input.accountId);
      }

      // If transfer destination provided, check ownership
      if (input.transferAccountId && input.transferAccountId !== existing.transferAccountId) {
        const destAcc = await tx.account.findFirst({
          where: { id: input.transferAccountId, userId },
        });
        if (!destAcc) throw new Error('Destination account not found.');
        affectedAccountIds.add(input.transferAccountId);
      }

      // 2. Perform update
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          ...(input.accountId && { accountId: input.accountId }),
          ...(input.transferAccountId !== undefined && { transferAccountId: input.transferAccountId }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.type && { type: input.type }),
          ...(input.amount && { amount: new Prisma.Decimal(input.amount) }),
          ...(input.currency && { currency: input.currency }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.occurredAt && { occurredAt: input.occurredAt }),
        },
      });

      // 3. Recompute balances for all touched accounts
      for (const accId of affectedAccountIds) {
        await AccountService.recomputeBalance(tx, userId, accId);
      }

      return updated;
    });
  }

  /**
   * Deletes a transaction, recomputes affected account balances,
   * and creates an audit log entry.
   */
  static async delete(userId: string, transactionId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!existing) {
        throw new Error('Transaction not found.');
      }

      const affectedAccountIds = [existing.accountId];
      if (existing.transferAccountId) {
        affectedAccountIds.push(existing.transferAccountId);
      }

      // Delete transaction
      await tx.transaction.delete({
        where: { id: transactionId },
      });

      // Audit log entry for sensitive action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transaction.delete',
          entityType: 'Transaction',
          entityId: transactionId,
          metadata: {
            amount: existing.amount.toString(),
            type: existing.type,
            accountId: existing.accountId,
          },
        },
      });

      // Recompute affected balances
      for (const accId of affectedAccountIds) {
        await AccountService.recomputeBalance(tx, userId, accId);
      }

      return { success: true };
    });
  }

  /**
   * Retrieves single transaction scoped to user.
   */
  static async getById(userId: string, transactionId: string) {
    return prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        account: { select: { id: true, name: true, color: true, icon: true } },
        transferAccount: { select: { id: true, name: true, color: true, icon: true } },
        category: { select: { id: true, name: true, color: true, icon: true, type: true } },
        goalContribution: { select: { id: true, goalId: true, amount: true } },
      },
    });
  }

  /**
   * Retrieves filtered and paginated transactions list.
   */
  static async list(userId: string, filters: TransactionFilterInput = {}) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.accountId && {
        OR: [{ accountId: filters.accountId }, { transferAccountId: filters.accountId }],
      }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.startDate && { occurredAt: { gte: filters.startDate } }),
      ...(filters.endDate && { occurredAt: { lte: filters.endDate } }),
      ...(filters.search && {
        OR: [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { notes: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, color: true, icon: true } },
          transferAccount: { select: { id: true, name: true, color: true, icon: true } },
          category: { select: { id: true, name: true, color: true, icon: true, type: true } },
        },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
