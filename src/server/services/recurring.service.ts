import prisma from '@/server/db/prisma';
import { CreateRecurringInput, UpdateRecurringInput } from '@/lib/validation/recurring.schema';
import { computeNextRun } from '@/lib/dates';
import { AccountService } from './account.service';
import { Prisma, NotifType } from '@prisma/client';

export class RecurringService {
  /**
   * Lists all recurring transactions owned by user.
   */
  static async list(userId: string) {
    return prisma.recurringTransaction.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
        _count: { select: { generatedTransactions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  /**
   * Retrieves single recurring transaction.
   */
  static async getById(userId: string, recurringId: string) {
    return prisma.recurringTransaction.findFirst({
      where: { id: recurringId, userId },
      include: {
        account: true,
        category: true,
        generatedTransactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Creates a recurring transaction schedule.
   */
  static async create(userId: string, input: CreateRecurringInput) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });
    if (!account) {
      throw new Error('Account not found.');
    }

    const startDate = new Date(input.startDate);

    return prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId || null,
        type: input.type,
        amount: new Prisma.Decimal(input.amount),
        description: input.description || null,
        frequency: input.frequency,
        interval: input.interval || 1,
        startDate,
        endDate: input.endDate ? new Date(input.endDate) : null,
        nextRunAt: startDate,
        isActive: true,
      },
    });
  }

  /**
   * Updates recurring transaction schedule.
   */
  static async update(userId: string, recurringId: string, input: UpdateRecurringInput) {
    const existing = await this.getById(userId, recurringId);
    if (!existing) {
      throw new Error('Recurring transaction not found.');
    }

    return prisma.recurringTransaction.update({
      where: { id: recurringId },
      data: {
        ...(input.accountId && { accountId: input.accountId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.type && { type: input.type }),
        ...(input.amount && { amount: new Prisma.Decimal(input.amount) }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.frequency && { frequency: input.frequency }),
        ...(input.interval && { interval: input.interval }),
        ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Toggles active / paused state.
   */
  static async toggleActive(userId: string, recurringId: string, isActive: boolean) {
    return this.update(userId, recurringId, { isActive });
  }

  /**
   * Deletes a recurring transaction schedule.
   */
  static async delete(userId: string, recurringId: string) {
    const existing = await this.getById(userId, recurringId);
    if (!existing) {
      throw new Error('Recurring transaction not found.');
    }

    return prisma.recurringTransaction.delete({
      where: { id: recurringId },
    });
  }

  /**
   * Catch-up generator: identifies all active recurring transactions due as of today,
   * generates real transaction ledger rows, updates account balances,
   * and advances nextRunAt idempotently (avoiding duplicate entries).
   */
  static async processCatchUp(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueList = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextRunAt: { lte: today },
      },
      include: { account: true },
    });

    let generatedCount = 0;

    for (const r of dueList) {
      let currentNextRun = new Date(r.nextRunAt);

      while (currentNextRun <= today && r.isActive) {
        // Idempotency check: did we already generate for this recurringId on this date?
        const dayStart = new Date(currentNextRun);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentNextRun);
        dayEnd.setHours(23, 59, 59, 999);

        const existing = await prisma.transaction.findFirst({
          where: {
            userId,
            recurringTransactionId: r.id,
            occurredAt: { gte: dayStart, lte: dayEnd },
          },
        });

        if (!existing) {
          // Generate the transaction atomically and update account balance
          await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId,
                accountId: r.accountId,
                categoryId: r.categoryId,
                type: r.type,
                amount: r.amount,
                currency: r.account.currency,
                description: r.description || 'Scheduled Recurring Transaction',
                occurredAt: currentNextRun,
                recurringTransactionId: r.id,
              },
            });

            await AccountService.recomputeBalance(tx, userId, r.accountId);
          });

          generatedCount++;
        }

        // Advance to next run
        const next = computeNextRun(currentNextRun, r.frequency, r.interval);
        currentNextRun = next;

        // Check if passed end date
        if (r.endDate && currentNextRun > r.endDate) {
          await prisma.recurringTransaction.update({
            where: { id: r.id },
            data: {
              isActive: false,
              lastRunAt: today,
              nextRunAt: currentNextRun,
            },
          });
          break;
        } else {
          await prisma.recurringTransaction.update({
            where: { id: r.id },
            data: {
              lastRunAt: today,
              nextRunAt: currentNextRun,
            },
          });
        }
      }
    }

    if (generatedCount > 0) {
      await prisma.notification.create({
        data: {
          userId,
          type: NotifType.recurring_due,
          title: `Generated ${generatedCount} recurring transaction(s)`,
          body: `Automatic catch-up executed successfully for your scheduled items.`,
          linkUrl: '/transactions',
        },
      });
    }

    return generatedCount;
  }
}
