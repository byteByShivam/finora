import prisma from '@/server/db/prisma';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilterInput,
} from '@/lib/validation/transaction.schema';
import { AccountService } from './account.service';
import { Prisma, TxnType } from '@prisma/client';

export class TransactionService {
  /**
   * Creates a transaction, updates the affected account balances atomically,
   * enforces user ownership, and records audit logs.
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

      // 3. Category verification (if provided for income/expense)
      if (input.type !== TxnType.transfer && input.categoryId) {
        const category = await tx.category.findFirst({
          where: {
            id: input.categoryId,
            OR: [{ userId: null }, { userId }],
          },
        });
        if (!category) {
          throw new Error('Category not found or does not belong to user.');
        }
        if (category.type !== (input.type as string)) {
          throw new Error(
            `Category type "${category.type}" does not match transaction type "${input.type}".`
          );
        }
      }

      const amountDec = new Prisma.Decimal(input.amount);
      if (amountDec.lessThanOrEqualTo(0)) {
        throw new Error('Amount must be greater than zero.');
      }

      // 4. Create transaction row
      const txn = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          transferAccountId: input.type === TxnType.transfer ? input.transferAccountId : null,
          categoryId: input.type === TxnType.transfer ? null : input.categoryId || null,
          type: input.type,
          amount: amountDec,
          currency: input.currency || sourceAccount.currency,
          description: input.description || null,
          notes: input.notes || null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          recurringTransactionId: input.recurringTransactionId || null,
        },
      });

      // 5. Recompute source account balance
      await AccountService.recomputeBalance(tx, userId, input.accountId);

      // 6. Recompute destination account balance if transfer
      if (input.type === TxnType.transfer && input.transferAccountId) {
        await AccountService.recomputeBalance(tx, userId, input.transferAccountId);
      }

      // 7. Audit log for transfers or transactions
      await tx.auditLog.create({
        data: {
          userId,
          action: input.type === TxnType.transfer ? 'transaction.transfer' : 'transaction.create',
          entityType: 'Transaction',
          entityId: txn.id,
          metadata: {
            type: txn.type,
            amount: txn.amount.toString(),
            accountId: txn.accountId,
            transferAccountId: txn.transferAccountId,
          },
        },
      }).catch(() => {});

      return txn;
    });
  }

  /**
   * Updates an existing transaction, reverses old effects, and applies new effects
   * across all affected account balances atomically inside a transaction.
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

      const targetType = input.type || existing.type;
      const targetAccountId = input.accountId || existing.accountId;

      // Verify new source account ownership if provided
      if (input.accountId && input.accountId !== existing.accountId) {
        const newAcc = await tx.account.findFirst({
          where: { id: input.accountId, userId },
        });
        if (!newAcc) {
          throw new Error('Source account not found or not owned by user.');
        }
        affectedAccountIds.add(input.accountId);
      }

      // Verify destination account if transfer
      let targetTransferAccountId = existing.transferAccountId;
      if (targetType === TxnType.transfer) {
        targetTransferAccountId =
          input.transferAccountId !== undefined ? input.transferAccountId : existing.transferAccountId;

        if (!targetTransferAccountId) {
          throw new Error('Destination account is required for transfers.');
        }
        if (targetTransferAccountId === targetAccountId) {
          throw new Error('Source and destination accounts cannot be identical.');
        }

        const destAcc = await tx.account.findFirst({
          where: { id: targetTransferAccountId, userId },
        });
        if (!destAcc) {
          throw new Error('Destination account not found or not owned by user.');
        }
        affectedAccountIds.add(targetTransferAccountId);
      } else {
        // If type changed from transfer to income/expense, clear transferAccountId
        targetTransferAccountId = null;
      }

      // Verify category if provided
      let targetCategoryId = existing.categoryId;
      if (targetType === TxnType.transfer) {
        targetCategoryId = null;
      } else if (input.categoryId !== undefined) {
        if (input.categoryId) {
          const category = await tx.category.findFirst({
            where: {
              id: input.categoryId,
              OR: [{ userId: null }, { userId }],
            },
          });
          if (!category) {
            throw new Error('Category not found or does not belong to user.');
          }
          if (category.type !== (targetType as string)) {
            throw new Error(
              `Category type "${category.type}" does not match transaction type "${targetType}".`
            );
          }
          targetCategoryId = input.categoryId;
        } else {
          targetCategoryId = null;
        }
      }

      // 2. Perform transaction update
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          accountId: targetAccountId,
          transferAccountId: targetTransferAccountId,
          categoryId: targetCategoryId,
          type: targetType,
          ...(input.amount !== undefined && { amount: new Prisma.Decimal(input.amount) }),
          ...(input.currency && { currency: input.currency }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.occurredAt && { occurredAt: new Date(input.occurredAt) }),
        },
      });

      // 3. Recompute balances for all touched accounts (reverses old and applies new)
      for (const accId of affectedAccountIds) {
        await AccountService.recomputeBalance(tx, userId, accId);
      }

      // 4. Audit log entry
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transaction.update',
          entityType: 'Transaction',
          entityId: transactionId,
          metadata: {
            oldAmount: existing.amount.toString(),
            newAmount: updated.amount.toString(),
            oldType: existing.type,
            newType: updated.type,
          },
        },
      }).catch(() => {});

      return updated;
    });
  }

  /**
   * Deletes a transaction, atomically reverses all balance impacts,
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

      const affectedAccountIds = new Set<string>([existing.accountId]);
      if (existing.transferAccountId) {
        affectedAccountIds.add(existing.transferAccountId);
      }

      // Delete transaction row
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
            transferAccountId: existing.transferAccountId,
          },
        },
      });

      // Recompute affected balances (restores balance to state without this transaction)
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
   * Retrieves filtered, sorted, and paginated transactions along with
   * database-aggregated income and expense summaries.
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
      ...(filters.search &&
        filters.search.trim() !== '' && {
          OR: [
            { description: { contains: filters.search.trim(), mode: 'insensitive' } },
            { notes: { contains: filters.search.trim(), mode: 'insensitive' } },
            { category: { name: { contains: filters.search.trim(), mode: 'insensitive' } } },
          ],
        }),
    };

    // Determine order by
    let orderBy: Prisma.TransactionOrderByWithRelationInput = { occurredAt: 'desc' };
    if (filters.sortBy === 'oldest') {
      orderBy = { occurredAt: 'asc' };
    } else if (filters.sortBy === 'highest_amount') {
      orderBy = { amount: 'desc' };
    } else if (filters.sortBy === 'lowest_amount') {
      orderBy = { amount: 'asc' };
    } else {
      orderBy = { occurredAt: 'desc' };
    }

    const [transactions, total, incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, color: true, icon: true } },
          transferAccount: { select: { id: true, name: true, color: true, icon: true } },
          category: { select: { id: true, name: true, color: true, icon: true, type: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...where, type: TxnType.income },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: TxnType.expense },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount || new Prisma.Decimal(0);
    const totalExpense = expenseAgg._sum.amount || new Prisma.Decimal(0);
    const netCashFlow = totalIncome.sub(totalExpense);

    return {
      transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      summary: {
        totalIncome,
        totalExpense,
        netCashFlow,
      },
    };
  }
}
