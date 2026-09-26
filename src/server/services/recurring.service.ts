import prisma from '@/server/db/prisma';
import { CreateRecurringInput, UpdateRecurringInput } from '@/lib/validation/recurring.schema';
import { computeNextRun } from '@/lib/dates';
import { TransactionService } from './transaction.service';
import { Prisma, TxnType, RecurFrequency, NotifType } from '@prisma/client';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface RecurringScheduleItem {
  id: string;
  userId: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  type: TxnType;
  amount: number;
  description: string | null;
  notes: string | null;
  frequency: RecurFrequency;
  interval: number;
  startDate: Date;
  startDateFormatted: string;
  endDate: Date | null;
  endDateFormatted: string | null;
  nextRunAt: Date;
  nextRunAtFormatted: string;
  lastRunAt: Date | null;
  lastRunAtFormatted: string | null;
  isActive: boolean;
  status: 'active' | 'paused' | 'completed';
  account: { id: string; name: string; color: string | null; type: string };
  transferAccount: { id: string; name: string; color: string | null; type: string } | null;
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
  generatedTransactionsCount: number;
}

export interface UpcomingRecurringItem {
  id: string;
  type: TxnType;
  amount: number;
  description: string | null;
  notes: string | null;
  frequency: RecurFrequency;
  interval: number;
  nextRunAt: string;
  nextRunAtFormatted: string;
  daysUntil: number;
  accountName: string;
  accountColor: string | null;
  transferAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

export interface RecurringSummaryStats {
  activeCount: number;
  pausedCount: number;
  completedCount: number;
  totalCount: number;
  projectedMonthlyIncome: number;
  projectedMonthlyExpenses: number;
  projectedMonthlyTransfers: number;
}

export class RecurringService {
  /**
   * Helper to format raw database record into typed RecurringScheduleItem DTO.
   */
  private static formatItem(
    r: any,
    now: Date = new Date()
  ): RecurringScheduleItem {
    const isCompleted = r.endDate ? new Date(r.endDate) < now : false;
    const status: 'active' | 'paused' | 'completed' = isCompleted
      ? 'completed'
      : r.isActive
      ? 'active'
      : 'paused';

    return {
      id: r.id,
      userId: r.userId,
      accountId: r.accountId,
      transferAccountId: r.transferAccountId,
      categoryId: r.categoryId,
      type: r.type,
      amount: r.amount instanceof Prisma.Decimal ? r.amount.toNumber() : Number(r.amount),
      description: r.description,
      notes: r.notes,
      frequency: r.frequency,
      interval: r.interval,
      startDate: r.startDate,
      startDateFormatted: format(r.startDate, 'dd MMM yyyy'),
      endDate: r.endDate,
      endDateFormatted: r.endDate ? format(r.endDate, 'dd MMM yyyy') : null,
      nextRunAt: r.nextRunAt,
      nextRunAtFormatted: format(r.nextRunAt, 'dd MMM yyyy'),
      lastRunAt: r.lastRunAt,
      lastRunAtFormatted: r.lastRunAt ? format(r.lastRunAt, 'dd MMM yyyy') : null,
      isActive: r.isActive,
      status,
      account: {
        id: r.account.id,
        name: r.account.name,
        color: r.account.color,
        type: r.account.type,
      },
      transferAccount: r.transferAccount
        ? {
            id: r.transferAccount.id,
            name: r.transferAccount.name,
            color: r.transferAccount.color,
            type: r.transferAccount.type,
          }
        : null,
      category: r.category
        ? {
            id: r.category.id,
            name: r.category.name,
            color: r.category.color,
            icon: r.category.icon,
          }
        : null,
      generatedTransactionsCount: r._count?.generatedTransactions || 0,
    };
  }

  /**
   * Lists all recurring transactions owned by user with optional status filter.
   */
  static async list(
    userId: string,
    filterStatus: 'all' | 'active' | 'paused' | 'completed' = 'all'
  ): Promise<RecurringScheduleItem[]> {
    const now = new Date();
    const where: Prisma.RecurringTransactionWhereInput = { userId };

    if (filterStatus === 'active') {
      where.isActive = true;
      where.OR = [{ endDate: null }, { endDate: { gte: now } }];
    } else if (filterStatus === 'paused') {
      where.isActive = false;
      where.OR = [{ endDate: null }, { endDate: { gte: now } }];
    } else if (filterStatus === 'completed') {
      where.endDate = { lt: now };
    }

    const records = await prisma.recurringTransaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        transferAccount: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
        _count: { select: { generatedTransactions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });

    return records.map((r) => this.formatItem(r, now));
  }

  /**
   * Retrieves single recurring transaction with ownership isolation.
   */
  static async getById(userId: string, recurringId: string) {
    const record = await prisma.recurringTransaction.findFirst({
      where: { id: recurringId, userId },
      include: {
        account: true,
        transferAccount: true,
        category: true,
        generatedTransactions: {
          orderBy: { occurredAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  /**
   * Returns upcoming recurring transactions sorted chronologically.
   * Powers the dashboard upcoming widget and recurring page preview.
   */
  static async getUpcoming(
    userId: string,
    limit = 5
  ): Promise<UpcomingRecurringItem[]> {
    const now = new Date();
    const startOfToday = startOfDay(now);

    const upcoming = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: startOfToday } }],
      },
      include: {
        account: { select: { id: true, name: true, color: true } },
        transferAccount: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });

    return upcoming.map((r) => {
      const nextRunDate = new Date(r.nextRunAt);
      const diffTime = nextRunDate.getTime() - startOfToday.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        type: r.type,
        amount: r.amount.toNumber(),
        description: r.description,
        notes: r.notes,
        frequency: r.frequency,
        interval: r.interval,
        nextRunAt: r.nextRunAt.toISOString(),
        nextRunAtFormatted: format(r.nextRunAt, 'dd MMM yyyy'),
        daysUntil,
        accountName: r.account.name,
        accountColor: r.account.color,
        transferAccountName: r.transferAccount?.name || null,
        categoryName: r.category?.name || null,
        categoryColor: r.category?.color || null,
        categoryIcon: r.category?.icon || null,
      };
    });
  }

  /**
   * Computes summary stats: active count, paused count, projected monthly inflow/outflow.
   */
  static async getSummaryStats(userId: string): Promise<RecurringSummaryStats> {
    const schedules = await prisma.recurringTransaction.findMany({
      where: { userId },
      select: {
        type: true,
        amount: true,
        frequency: true,
        interval: true,
        isActive: true,
        endDate: true,
      },
    });

    const now = new Date();
    let activeCount = 0;
    let pausedCount = 0;
    let completedCount = 0;

    let monthlyIncomeDec = new Prisma.Decimal(0);
    let monthlyExpensesDec = new Prisma.Decimal(0);
    let monthlyTransfersDec = new Prisma.Decimal(0);

    for (const s of schedules) {
      const isCompleted = s.endDate ? new Date(s.endDate) < now : false;

      if (isCompleted) {
        completedCount++;
        continue;
      }

      if (!s.isActive) {
        pausedCount++;
        continue;
      }

      activeCount++;

      // Monthly normalization multiplier based on frequency
      // daily: 365 / 12 = 30.4166
      // weekly: 52 / 12 = 4.3333
      // biweekly: 26 / 12 = 2.1666
      // monthly: 1
      // yearly: 1 / 12 = 0.0833
      let multiplier = 1;
      const interval = Math.max(1, s.interval);

      switch (s.frequency) {
        case RecurFrequency.daily:
          multiplier = 30.4166 / interval;
          break;
        case RecurFrequency.weekly:
          multiplier = 4.3333 / interval;
          break;
        case RecurFrequency.biweekly:
          multiplier = 2.1666 / interval;
          break;
        case RecurFrequency.monthly:
          multiplier = 1 / interval;
          break;
        case RecurFrequency.yearly:
          multiplier = (1 / 12) / interval;
          break;
      }

      const monthlyEquiv = s.amount.mul(new Prisma.Decimal(multiplier));

      if (s.type === TxnType.income) {
        monthlyIncomeDec = monthlyIncomeDec.add(monthlyEquiv);
      } else if (s.type === TxnType.expense) {
        monthlyExpensesDec = monthlyExpensesDec.add(monthlyEquiv);
      } else if (s.type === TxnType.transfer) {
        monthlyTransfersDec = monthlyTransfersDec.add(monthlyEquiv);
      }
    }

    return {
      activeCount,
      pausedCount,
      completedCount,
      totalCount: schedules.length,
      projectedMonthlyIncome: Math.round(monthlyIncomeDec.toNumber()),
      projectedMonthlyExpenses: Math.round(monthlyExpensesDec.toNumber()),
      projectedMonthlyTransfers: Math.round(monthlyTransfersDec.toNumber()),
    };
  }

  /**
   * Creates a recurring transaction schedule with full validation and user scoping.
   */
  static async create(userId: string, input: CreateRecurringInput) {
    const amountDec = new Prisma.Decimal(input.amount);
    if (amountDec.lessThanOrEqualTo(0)) {
      throw new Error('Amount must be greater than zero.');
    }

    // 1. Verify source account ownership
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });
    if (!account) {
      throw new Error('Source account not found or not owned by user.');
    }

    // 2. Transfer verification
    if (input.type === TxnType.transfer) {
      if (!input.transferAccountId) {
        throw new Error('Destination account is required for recurring transfers.');
      }
      if (input.transferAccountId === input.accountId) {
        throw new Error('Source and destination accounts cannot be identical.');
      }

      const destAccount = await prisma.account.findFirst({
        where: { id: input.transferAccountId, userId },
      });
      if (!destAccount) {
        throw new Error('Destination account not found or not owned by user.');
      }
    }

    // 3. Category verification (for non-transfer)
    if (input.type !== TxnType.transfer && input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ userId: null }, { userId }],
        },
      });
      if (!category) {
        throw new Error('Category not found.');
      }
      if (category.type !== (input.type as string)) {
        throw new Error(
          `Category type "${category.type}" does not match recurring schedule type "${input.type}".`
        );
      }
    }

    const startDate = new Date(input.startDate || new Date());
    const endDate = input.endDate ? new Date(input.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new Error('End date must be on or after start date.');
    }

    const created = await prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: input.accountId,
        transferAccountId: input.type === TxnType.transfer ? input.transferAccountId : null,
        categoryId: input.type === TxnType.transfer ? null : input.categoryId || null,
        type: input.type,
        amount: amountDec,
        description: input.description || null,
        notes: input.notes || null,
        frequency: input.frequency,
        interval: input.interval || 1,
        startDate,
        endDate,
        nextRunAt: startDate,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'recurring.create',
        entityType: 'RecurringTransaction',
        entityId: created.id,
        metadata: {
          type: created.type,
          amount: created.amount.toString(),
          frequency: created.frequency,
          nextRunAt: created.nextRunAt.toISOString(),
        },
      },
    }).catch(() => {});

    return created;
  }

  /**
   * Updates recurring transaction schedule.
   * Modifying configuration NEVER alters historical ledger transactions.
   */
  static async update(userId: string, recurringId: string, input: UpdateRecurringInput) {
    const existing = await this.getById(userId, recurringId);
    if (!existing) {
      throw new Error('Recurring schedule not found.');
    }

    const targetType = input.type || existing.type;
    const targetAccountId = input.accountId || existing.accountId;

    // Verify new source account if changed
    if (input.accountId && input.accountId !== existing.accountId) {
      const newAcc = await prisma.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!newAcc) {
        throw new Error('Source account not found.');
      }
    }

    // Transfer verification
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

      const destAcc = await prisma.account.findFirst({
        where: { id: targetTransferAccountId, userId },
      });
      if (!destAcc) {
        throw new Error('Destination account not found.');
      }
    }

    // Category verification
    if (targetType !== TxnType.transfer && input.categoryId) {
      const cat = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ userId: null }, { userId }],
        },
      });
      if (!cat) {
        throw new Error('Category not found.');
      }
      if (cat.type !== (targetType as string)) {
        throw new Error(`Category type "${cat.type}" does not match schedule type "${targetType}".`);
      }
    }

    const amountDec = input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined;
    if (amountDec && amountDec.lessThanOrEqualTo(0)) {
      throw new Error('Amount must be greater than zero.');
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id: recurringId },
      data: {
        ...(input.accountId && { accountId: input.accountId }),
        ...(input.transferAccountId !== undefined && {
          transferAccountId: targetType === TxnType.transfer ? input.transferAccountId : null,
        }),
        ...(input.categoryId !== undefined && {
          categoryId: targetType === TxnType.transfer ? null : input.categoryId,
        }),
        ...(input.type && { type: input.type }),
        ...(amountDec && { amount: amountDec }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.frequency && { frequency: input.frequency }),
        ...(input.interval && { interval: input.interval }),
        ...(input.nextRunAt && { nextRunAt: new Date(input.nextRunAt) }),
        ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'recurring.update',
        entityType: 'RecurringTransaction',
        entityId: recurringId,
        metadata: {
          changes: Object.keys(input),
        },
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Toggles active / paused state.
   * When resuming from pause, if nextRunAt is in the past, advances nextRunAt to today.
   */
  static async toggleActive(userId: string, recurringId: string, isActive: boolean) {
    const existing = await this.getById(userId, recurringId);
    if (!existing) {
      throw new Error('Recurring schedule not found.');
    }

    const now = new Date();
    const startOfToday = startOfDay(now);

    let nextRunAt = existing.nextRunAt;
    if (isActive && existing.nextRunAt < startOfToday) {
      // When resuming an old paused schedule, start from today
      nextRunAt = startOfToday;
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id: recurringId },
      data: {
        isActive,
        nextRunAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: isActive ? 'recurring.resume' : 'recurring.pause',
        entityType: 'RecurringTransaction',
        entityId: recurringId,
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Deletes a recurring transaction schedule.
   * Guaranteed: Historical transactions survive via ON DELETE SET NULL.
   */
  static async delete(userId: string, recurringId: string) {
    const existing = await this.getById(userId, recurringId);
    if (!existing) {
      throw new Error('Recurring schedule not found.');
    }

    const deleted = await prisma.recurringTransaction.delete({
      where: { id: recurringId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'recurring.delete',
        entityType: 'RecurringTransaction',
        entityId: recurringId,
      },
    }).catch(() => {});

    return deleted;
  }

  /**
   * Catch-up generator: identifies all active recurring transactions due as of today,
   * generates real transaction ledger rows via TransactionService, updates account balances,
   * and advances nextRunAt idempotently (avoiding duplicate entries).
   *
   * Idempotency guarantee:
   * 1. Application-level check for (recurringTransactionId, occurredAt).
   * 2. Database-level UNIQUE constraint on (recurring_transaction_id, occurred_at).
   * 3. Uses TransactionService.create to enforce ledger math & account balance recomputation.
   */
  static async processCatchUp(userId: string): Promise<number> {
    const today = new Date();
    const endOfToday = endOfDay(today);

    // Fetch active recurring transactions due on or before today
    const dueList = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextRunAt: { lte: endOfToday },
      },
      include: {
        account: true,
        transferAccount: true,
      },
    });

    let generatedCount = 0;

    for (const r of dueList) {
      let currentNextRun = new Date(r.nextRunAt);
      let occurrencesGenerated = 0;
      const MAX_BACKLOG_OCCURRENCES = 100; // Safety cap per finora-architecture.md §17

      while (currentNextRun <= endOfToday && r.isActive && occurrencesGenerated < MAX_BACKLOG_OCCURRENCES) {
        // Check if passed end date
        if (r.endDate && currentNextRun > r.endDate) {
          await prisma.recurringTransaction.update({
            where: { id: r.id },
            data: {
              isActive: false,
              lastRunAt: today,
            },
          });
          break;
        }

        // Idempotency check: did we already generate for this recurringId on this date?
        const dayStart = startOfDay(currentNextRun);
        const dayEnd = endOfDay(currentNextRun);

        const existingTxn = await prisma.transaction.findFirst({
          where: {
            userId,
            recurringTransactionId: r.id,
            occurredAt: { gte: dayStart, lte: dayEnd },
          },
        });

        if (!existingTxn) {
          try {
            // Generate real transaction using TransactionService (guarantees account balance recomputation & audit logging)
            await TransactionService.create(userId, {
              accountId: r.accountId,
              transferAccountId: r.type === TxnType.transfer ? r.transferAccountId : null,
              categoryId: r.type === TxnType.transfer ? null : r.categoryId,
              type: r.type,
              amount: r.amount.toNumber(),
              currency: r.account.currency,
              description: r.description || `Scheduled ${r.type.toUpperCase()}`,
              notes: r.notes || null,
              occurredAt: currentNextRun,
              recurringTransactionId: r.id,
            });

            generatedCount++;
            occurrencesGenerated++;
          } catch (createErr: any) {
            // If duplicate unique constraint P2002 triggered by concurrent execution, ignore and proceed
            if (createErr?.code !== 'P2002') {
              console.error(`[RecurringService] Failed to generate transaction for schedule ${r.id}:`, createErr);
            }
          }
        }

        // Advance to next run
        const next = computeNextRun(currentNextRun, r.frequency, r.interval);
        currentNextRun = next;

        // Check if new next run exceeds end date
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
      }).catch(() => {});
    }

    return generatedCount;
  }

  /**
   * System-wide catch-up for all users.
   * Can be invoked by external cron job or deployment worker via /api/cron/recurring.
   */
  static async processAllCatchUp(): Promise<{ totalGenerated: number; usersProcessed: number }> {
    const today = new Date();
    const endOfToday = endOfDay(today);

    // Find all users with due recurring schedules
    const dueUsers = await prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: endOfToday },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    let totalGenerated = 0;

    for (const u of dueUsers) {
      try {
        const count = await this.processCatchUp(u.userId);
        totalGenerated += count;
      } catch (err) {
        console.error(`[RecurringService] Error processing catch-up for user ${u.userId}:`, err);
      }
    }

    return {
      totalGenerated,
      usersProcessed: dueUsers.length,
    };
  }
}
