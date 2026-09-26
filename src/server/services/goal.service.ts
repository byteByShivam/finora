import prisma from '@/server/db/prisma';
import {
  CreateGoalInput,
  UpdateGoalInput,
  AddContributionInput,
  UpdateContributionInput,
} from '@/lib/validation/goal.schema';
import { GoalStatus, Prisma, NotifType, TxnType } from '@prisma/client';
import { TransactionService } from '@/server/services/transaction.service';
import { format, differenceInMonths, addMonths } from 'date-fns';

export type DynamicGoalStatus =
  | 'completed'
  | 'on_track'
  | 'at_risk'
  | 'overdue'
  | 'active'
  | 'archived';

export interface GoalWithProgress {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentage: number;
  targetDate: Date | null;
  targetDateFormatted: string | null;
  accountId: string | null;
  account: { id: string; name: string; color: string | null } | null;
  icon: string | null;
  color: string | null;
  status: GoalStatus;
  dynamicStatus: DynamicGoalStatus;
  contributionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalSummaryStats {
  totalTarget: number;
  totalSaved: number;
  totalRemaining: number;
  overallPercentage: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  totalGoalsCount: number;
}

export interface GoalProjections {
  averageMonthlyContribution: number | null;
  estimatedCompletionDate: string | null;
  requiredMonthlyContribution: number | null;
  hasEnoughData: boolean;
}

export interface GoalTrendPoint {
  date: string;
  amount: number;
  cumulative: number;
}

export interface GoalDetail extends Omit<GoalWithProgress, 'currentAmount' | 'targetAmount'> {
  goal: GoalWithProgress;
  contributions: Array<{
    id: string;
    amount: number;
    note: string | null;
    createdAt: Date;
    createdAtFormatted: string;
    transaction: {
      id: string;
      description: string | null;
      occurredAt: Date;
      occurredAtFormatted: string;
      accountName?: string;
    } | null;
  }>;
  projections: GoalProjections;
  trend: GoalTrendPoint[];
  currentAmount: Prisma.Decimal;
  targetAmount: Prisma.Decimal;
}

export class GoalService {
  /**
   * Computes the dynamic status of a goal based on target, saved amount, target date, and time elapsed.
   */
  static calculateDynamicStatus(
    status: GoalStatus,
    targetAmount: Prisma.Decimal,
    currentAmount: Prisma.Decimal,
    targetDate: Date | null,
    createdAt: Date,
    now: Date = new Date()
  ): DynamicGoalStatus {
    if (status === GoalStatus.archived) {
      return 'archived';
    }

    if (currentAmount.greaterThanOrEqualTo(targetAmount)) {
      return 'completed';
    }

    if (targetDate) {
      const targetTime = targetDate.getTime();
      const nowTime = now.getTime();
      const createdTime = createdAt.getTime();

      // Overdue: deadline has passed and target not met
      if (nowTime > targetTime) {
        return 'overdue';
      }

      // Calculate time-based progress expectations
      const totalDuration = targetTime - createdTime;
      const elapsedDuration = nowTime - createdTime;

      if (totalDuration > 0 && elapsedDuration > 0) {
        const timeRatio = Math.min(1, Math.max(0, elapsedDuration / totalDuration));
        const expectedPct = timeRatio * 100;
        const actualPct = targetAmount.greaterThan(0)
          ? currentAmount.div(targetAmount).mul(100).toNumber()
          : 0;

        // If actual progress is within 80% of expected or within 10 percentage points
        if (actualPct >= expectedPct * 0.8 || actualPct >= expectedPct - 10) {
          return 'on_track';
        } else {
          return 'at_risk';
        }
      }
    }

    return 'active';
  }

  /**
   * Formats a raw Prisma goal record into a type-safe GoalWithProgress DTO.
   */
  static formatGoal(
    g: {
      id: string;
      userId: string;
      name: string;
      description: string | null;
      targetAmount: Prisma.Decimal;
      currentAmount: Prisma.Decimal;
      targetDate: Date | null;
      accountId: string | null;
      icon: string | null;
      color: string | null;
      status: GoalStatus;
      createdAt: Date;
      updatedAt: Date;
      account?: { id: string; name: string; color: string | null } | null;
      _count?: { contributions: number };
    },
    now: Date = new Date()
  ): GoalWithProgress {
    const targetDec = g.targetAmount;
    const currentDec = g.currentAmount;
    const remainingDec = targetDec.sub(currentDec);

    const targetNum = targetDec.toNumber();
    const currentNum = currentDec.toNumber();
    const remainingNum = remainingDec.toNumber();

    let percentage = 0;
    if (targetDec.greaterThan(0)) {
      const rawPct = currentDec.div(targetDec).mul(100).toNumber();
      percentage = Math.round(rawPct * 100) / 100;
    }

    const dynamicStatus = GoalService.calculateDynamicStatus(
      g.status,
      targetDec,
      currentDec,
      g.targetDate,
      g.createdAt,
      now
    );

    return {
      id: g.id,
      userId: g.userId,
      name: g.name,
      description: g.description,
      targetAmount: targetNum,
      currentAmount: currentNum,
      remainingAmount: remainingNum,
      percentage,
      targetDate: g.targetDate,
      targetDateFormatted: g.targetDate ? format(g.targetDate, 'dd MMM yyyy') : null,
      accountId: g.accountId,
      account: g.account || null,
      icon: g.icon,
      color: g.color,
      status: g.status,
      dynamicStatus,
      contributionCount: g._count?.contributions ?? 0,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  /**
   * Lists all goals for a user with calculated progress and contribution counts.
   */
  static async list(userId: string): Promise<GoalWithProgress[]> {
    const goals = await prisma.financialGoal.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        _count: { select: { contributions: true } },
      },
      orderBy: [{ status: 'asc' }, { targetDate: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    return goals.map((g) => GoalService.formatGoal(g, now));
  }

  /**
   * Computes aggregate summary statistics across all goals for a user.
   */
  static async getSummaryStats(userId: string): Promise<GoalSummaryStats> {
    const goals = await prisma.financialGoal.findMany({
      where: { userId, status: { not: GoalStatus.archived } },
      select: {
        targetAmount: true,
        currentAmount: true,
        status: true,
      },
    });

    if (goals.length === 0) {
      return {
        totalTarget: 0,
        totalSaved: 0,
        totalRemaining: 0,
        overallPercentage: 0,
        activeGoalsCount: 0,
        completedGoalsCount: 0,
        totalGoalsCount: 0,
      };
    }

    let totalTargetDec = new Prisma.Decimal(0);
    let totalSavedDec = new Prisma.Decimal(0);
    let completedCount = 0;
    let activeCount = 0;

    for (const g of goals) {
      totalTargetDec = totalTargetDec.add(g.targetAmount);
      totalSavedDec = totalSavedDec.add(g.currentAmount);

      if (g.currentAmount.greaterThanOrEqualTo(g.targetAmount) || g.status === GoalStatus.achieved) {
        completedCount++;
      } else {
        activeCount++;
      }
    }

    const totalRemainingDec = totalTargetDec.sub(totalSavedDec);
    let overallPercentage = 0;
    if (totalTargetDec.greaterThan(0)) {
      const rawPct = totalSavedDec.div(totalTargetDec).mul(100).toNumber();
      overallPercentage = Math.round(rawPct * 100) / 100;
    }

    return {
      totalTarget: totalTargetDec.toNumber(),
      totalSaved: totalSavedDec.toNumber(),
      totalRemaining: totalRemainingDec.toNumber(),
      overallPercentage,
      activeGoalsCount: activeCount,
      completedGoalsCount: completedCount,
      totalGoalsCount: goals.length,
    };
  }

  /**
   * Retrieves single goal owned by user with contributions history, projections, and trend data.
   */
  static async getById(userId: string, goalId: string): Promise<GoalDetail | null> {
    const goal = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        contributions: {
          include: {
            transaction: {
              select: {
                id: true,
                description: true,
                occurredAt: true,
                account: { select: { name: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
        _count: { select: { contributions: true } },
      },
    });

    if (!goal) {
      return null;
    }

    const now = new Date();
    const formattedGoal = GoalService.formatGoal(goal, now);

    // Format contributions
    const contributions = goal.contributions.map((c) => ({
      id: c.id,
      amount: c.amount.toNumber(),
      note: c.note,
      createdAt: c.createdAt,
      createdAtFormatted: format(c.createdAt, 'dd MMM yyyy, hh:mm a'),
      transaction: c.transaction
        ? {
            id: c.transaction.id,
            description: c.transaction.description,
            occurredAt: c.transaction.occurredAt,
            occurredAtFormatted: format(c.transaction.occurredAt, 'dd MMM yyyy'),
            accountName: c.transaction.account?.name,
          }
        : null,
    }));

    // Projections calculation
    const projections = GoalService.calculateProjections(
      goal.targetAmount,
      goal.currentAmount,
      goal.targetDate,
      goal.contributions.map((c) => ({ amount: c.amount, createdAt: c.createdAt })),
      now
    );

    // Cumulative trend points
    // Sort chronological ascending
    const chronological = [...goal.contributions].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    let runningDec = new Prisma.Decimal(0);
    const trendMap = new Map<string, { amount: Prisma.Decimal; cumulative: Prisma.Decimal }>();

    for (const c of chronological) {
      const dateKey = format(c.createdAt, 'dd MMM');
      runningDec = runningDec.add(c.amount);

      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.amount = existing.amount.add(c.amount);
        existing.cumulative = runningDec;
      } else {
        trendMap.set(dateKey, {
          amount: c.amount,
          cumulative: runningDec,
        });
      }
    }

    const trend: GoalTrendPoint[] = Array.from(trendMap.entries()).map(([date, val]) => ({
      date,
      amount: val.amount.toNumber(),
      cumulative: val.cumulative.toNumber(),
    }));

    return {
      ...formattedGoal,
      currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount,
      goal: formattedGoal,
      contributions,
      projections,
      trend,
    };
  }

  /**
   * Calculates projections reliably from contribution history and target date.
   */
  static calculateProjections(
    targetAmount: Prisma.Decimal,
    currentAmount: Prisma.Decimal,
    targetDate: Date | null,
    contributions: Array<{ amount: Prisma.Decimal; createdAt: Date }>,
    now: Date = new Date()
  ): GoalProjections {
    const isCompleted = currentAmount.greaterThanOrEqualTo(targetAmount);
    const remaining = targetAmount.sub(currentAmount);

    if (isCompleted || remaining.lessThanOrEqualTo(0)) {
      return {
        averageMonthlyContribution: null,
        estimatedCompletionDate: null,
        requiredMonthlyContribution: 0,
        hasEnoughData: true,
      };
    }

    // Required monthly contribution based on target date
    let requiredMonthly: number | null = null;
    if (targetDate && targetDate > now) {
      const monthsUntilTarget = Math.max(1, differenceInMonths(targetDate, now));
      requiredMonthly = Math.round(remaining.div(monthsUntilTarget).toNumber() * 100) / 100;
    }

    // Historical average contribution if at least 2 contributions or spanning time
    if (contributions.length < 2) {
      return {
        averageMonthlyContribution: null,
        estimatedCompletionDate: null,
        requiredMonthlyContribution: requiredMonthly,
        hasEnoughData: false,
      };
    }

    // Calculate time span of contributions
    const dates = contributions.map((c) => c.createdAt.getTime());
    const minDate = new Date(Math.min(...dates));
    const monthsSpan = Math.max(1, differenceInMonths(now, minDate) + 1);

    let totalHistory = new Prisma.Decimal(0);
    for (const c of contributions) {
      totalHistory = totalHistory.add(c.amount);
    }

    const avgMonthlyDec = totalHistory.div(monthsSpan);
    const avgMonthlyNum = Math.round(avgMonthlyDec.toNumber() * 100) / 100;

    let estimatedCompletionDate: string | null = null;
    if (avgMonthlyDec.greaterThan(0)) {
      const monthsNeeded = Math.ceil(remaining.div(avgMonthlyDec).toNumber());
      if (monthsNeeded > 0 && monthsNeeded <= 240) {
        // cap at 20 years projection
        const estDate = addMonths(now, monthsNeeded);
        estimatedCompletionDate = format(estDate, 'MMM yyyy');
      }
    }

    return {
      averageMonthlyContribution: avgMonthlyNum,
      estimatedCompletionDate,
      requiredMonthlyContribution: requiredMonthly,
      hasEnoughData: true,
    };
  }

  /**
   * Creates a new financial goal.
   */
  static async create(userId: string, input: CreateGoalInput) {
    // 1. Verify account ownership if account is linked
    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!account) {
        throw new Error('Linked account not found or access denied.');
      }
    }

    const targetDec = new Prisma.Decimal(input.targetAmount);

    const goal = await prisma.financialGoal.create({
      data: {
        userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        targetAmount: targetDec,
        currentAmount: new Prisma.Decimal(0),
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        accountId: input.accountId || null,
        icon: input.icon?.trim() || 'Target',
        color: input.color?.trim() || '#10b981',
        status: GoalStatus.active,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'goal.create',
        entityType: 'goal',
        entityId: goal.id,
        metadata: {
          name: goal.name,
          targetAmount: input.targetAmount,
          accountId: input.accountId,
        },
      },
    });

    return goal;
  }

  /**
   * Updates an existing financial goal.
   */
  static async update(userId: string, goalId: string, input: UpdateGoalInput) {
    const existing = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new Error('Goal not found.');
    }

    // Verify account ownership if account is being linked/updated
    if (input.accountId && input.accountId !== existing.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!account) {
        throw new Error('Linked account not found or access denied.');
      }
    }

    const newTargetDec = input.targetAmount !== undefined
      ? new Prisma.Decimal(input.targetAmount)
      : existing.targetAmount;

    // Check if goal completion status changes based on new target
    let newStatus = input.status !== undefined ? input.status : existing.status;
    if (newStatus !== GoalStatus.archived) {
      if (existing.currentAmount.greaterThanOrEqualTo(newTargetDec)) {
        newStatus = GoalStatus.achieved;
      } else if (existing.status === GoalStatus.achieved && existing.currentAmount.lessThan(newTargetDec)) {
        newStatus = GoalStatus.active;
      }
    }

    const updated = await prisma.financialGoal.update({
      where: { id: goalId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.targetAmount !== undefined ? { targetAmount: newTargetDec } : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
          : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId || null } : {}),
        ...(input.icon !== undefined ? { icon: input.icon?.trim() || 'Target' } : {}),
        ...(input.color !== undefined ? { color: input.color?.trim() || '#10b981' } : {}),
        status: newStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'goal.update',
        entityType: 'goal',
        entityId: goalId,
        metadata: {
          previousTarget: existing.targetAmount.toNumber(),
          newTarget: updated.targetAmount.toNumber(),
          status: newStatus,
        },
      },
    });

    return updated;
  }

  /**
   * Archives a financial goal.
   */
  static async archive(userId: string, goalId: string) {
    return GoalService.update(userId, goalId, { status: GoalStatus.archived });
  }

  /**
   * Deletes a financial goal safely.
   */
  static async delete(userId: string, goalId: string) {
    const goal = await prisma.financialGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new Error('Goal not found.');
    }

    const deleted = await prisma.financialGoal.delete({
      where: { id: goalId },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'goal.delete',
        entityType: 'goal',
        entityId: goalId,
        metadata: {
          name: goal.name,
          finalAmount: goal.currentAmount.toNumber(),
        },
      },
    });

    return deleted;
  }

  /**
   * Contributes to a goal atomically.
   * If a source account is provided and the goal has a linked account,
   * creates an atomic ledger transfer transaction between accounts.
   * Otherwise records a direct goal savings contribution.
   */
  static async addContribution(userId: string, goalId: string, input: AddContributionInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify goal exists and is owned by userId
      const goal = await tx.financialGoal.findFirst({
        where: { id: goalId, userId },
      });

      if (!goal) {
        throw new Error('Goal not found or access denied.');
      }

      if (goal.status === GoalStatus.archived) {
        throw new Error('Cannot contribute to an archived goal.');
      }

      const contribDec = new Prisma.Decimal(input.amount);
      const contributionDate = input.date ? new Date(input.date) : new Date();

      let linkedTxnId: string | null = null;

      // 2. Account Integration: if sourceAccountId provided
      if (input.sourceAccountId) {
        const sourceAcc = await tx.account.findFirst({
          where: { id: input.sourceAccountId, userId, isArchived: false },
        });

        if (!sourceAcc) {
          throw new Error('Funding source account not found or access denied.');
        }

        // If goal has a linked account and it's distinct from source: transfer!
        if (goal.accountId && goal.accountId !== input.sourceAccountId) {
          const destAcc = await tx.account.findFirst({
            where: { id: goal.accountId, userId, isArchived: false },
          });

          if (destAcc) {
            // Create atomic transfer transaction via ledger
            const transferTxn = await TransactionService.create(userId, {
              accountId: sourceAcc.id,
              transferAccountId: destAcc.id,
              type: TxnType.transfer,
              amount: input.amount,
              description: `Goal Contribution: ${goal.name}`,
              notes: input.note || null,
              occurredAt: contributionDate,
            });
            linkedTxnId = transferTxn.id;
          }
        }
      } else if (input.transactionId) {
        // Link to existing transaction
        const existingTxn = await tx.transaction.findFirst({
          where: { id: input.transactionId, userId },
          include: { goalContribution: true },
        });

        if (!existingTxn) {
          throw new Error('Transaction not found or access denied.');
        }

        if (existingTxn.goalContribution) {
          throw new Error('This transaction is already linked to a goal contribution.');
        }

        if (contribDec.greaterThan(existingTxn.amount)) {
          throw new Error(
            `Contribution amount (Rs. ${contribDec.toString()}) cannot exceed transaction amount (Rs. ${existingTxn.amount.toString()}).`
          );
        }

        linkedTxnId = existingTxn.id;
      }

      // 3. Create GoalContribution record
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: goal.id,
          amount: contribDec,
          note: input.note?.trim() || null,
          transactionId: linkedTxnId,
          createdAt: contributionDate,
        },
      });

      // 4. Atomically recompute goal's current_amount from contributions ledger
      const sumAgg = await tx.goalContribution.aggregate({
        where: { goalId: goal.id },
        _sum: { amount: true },
      });

      const newTotal = sumAgg._sum.amount || new Prisma.Decimal(0);

      // Check if goal reached or surpassed target
      let newStatus = goal.status;
      if (newTotal.greaterThanOrEqualTo(goal.targetAmount)) {
        newStatus = GoalStatus.achieved;
      } else if (goal.status === GoalStatus.achieved && newTotal.lessThan(goal.targetAmount)) {
        newStatus = GoalStatus.active;
      }

      await tx.financialGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: newTotal,
          status: newStatus,
        },
      });

      // 5. Audit log entry
      await tx.auditLog.create({
        data: {
          userId,
          action: 'goal.contribute',
          entityType: 'goal',
          entityId: goal.id,
          metadata: {
            contributionId: contribution.id,
            amount: input.amount,
            newTotal: newTotal.toNumber(),
            linkedTxnId,
          },
        },
      });

      // 6. In-app Milestone & Achievement Notifications
      if (newStatus === GoalStatus.achieved && goal.status !== GoalStatus.achieved) {
        await tx.notification.create({
          data: {
            userId,
            type: NotifType.goal_achieved,
            title: `Goal Achieved: ${goal.name}!`,
            body: `Congratulations! You reached your savings target of Rs. ${goal.targetAmount.toFixed(2)}.`,
            linkUrl: `/goals/${goal.id}`,
          },
        });
      } else {
        const prevPct = goal.targetAmount.greaterThan(0)
          ? goal.currentAmount.div(goal.targetAmount).mul(100).toNumber()
          : 0;
        const currentPct = goal.targetAmount.greaterThan(0)
          ? newTotal.div(goal.targetAmount).mul(100).toNumber()
          : 0;

        if (prevPct < 50 && currentPct >= 50) {
          await tx.notification.create({
            data: {
              userId,
              type: NotifType.goal_milestone,
              title: `Halfway milestone reached: ${goal.name} (50%)`,
              body: `You have saved Rs. ${newTotal.toFixed(2)} towards your Rs. ${goal.targetAmount.toFixed(2)} goal.`,
              linkUrl: `/goals/${goal.id}`,
            },
          });
        }
      }

      return contribution;
    });
  }

  /**
   * Backward-compatible alias for contribute.
   */
  static async contribute(userId: string, input: AddContributionInput) {
    return GoalService.addContribution(userId, input.goalId, input);
  }

  /**
   * Updates an existing contribution and recalibrates goal progress.
   */
  static async updateContribution(
    userId: string,
    goalId: string,
    contributionId: string,
    input: UpdateContributionInput
  ) {
    return prisma.$transaction(async (tx) => {
      const goal = await tx.financialGoal.findFirst({
        where: { id: goalId, userId },
      });

      if (!goal) {
        throw new Error('Goal not found or access denied.');
      }

      const existingContrib = await tx.goalContribution.findFirst({
        where: { id: contributionId, goalId },
      });

      if (!existingContrib) {
        throw new Error('Contribution not found.');
      }

      const updated = await tx.goalContribution.update({
        where: { id: contributionId },
        data: {
          ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
          ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
          ...(input.date !== undefined ? { createdAt: new Date(input.date) } : {}),
        },
      });

      // Recalculate goal total
      const sumAgg = await tx.goalContribution.aggregate({
        where: { goalId },
        _sum: { amount: true },
      });

      const newTotal = sumAgg._sum.amount || new Prisma.Decimal(0);
      let newStatus = goal.status;
      if (newTotal.greaterThanOrEqualTo(goal.targetAmount)) {
        newStatus = GoalStatus.achieved;
      } else if (goal.status === GoalStatus.achieved && newTotal.lessThan(goal.targetAmount)) {
        newStatus = GoalStatus.active;
      }

      await tx.financialGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: newTotal,
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'goal.contribution.update',
          entityType: 'goal',
          entityId: goalId,
          metadata: {
            contributionId,
            previousAmount: existingContrib.amount.toNumber(),
            newAmount: updated.amount.toNumber(),
          },
        },
      });

      return updated;
    });
  }

  /**
   * Deletes a contribution, reverses its progress, and safely cascades to any linked ledger transaction.
   */
  static async deleteContribution(userId: string, goalId: string, contributionId: string) {
    return prisma.$transaction(async (tx) => {
      const goal = await tx.financialGoal.findFirst({
        where: { id: goalId, userId },
      });

      if (!goal) {
        throw new Error('Goal not found or access denied.');
      }

      const contrib = await tx.goalContribution.findFirst({
        where: { id: contributionId, goalId },
      });

      if (!contrib) {
        throw new Error('Contribution not found.');
      }

      // If this contribution was linked to a transaction, check if it was an auto-transfer
      const linkedTxnId = contrib.transactionId;

      await tx.goalContribution.delete({
        where: { id: contributionId },
      });

      // Recompute goal total
      const sumAgg = await tx.goalContribution.aggregate({
        where: { goalId },
        _sum: { amount: true },
      });

      const newTotal = sumAgg._sum.amount || new Prisma.Decimal(0);
      let newStatus = goal.status;
      if (newTotal.greaterThanOrEqualTo(goal.targetAmount)) {
        newStatus = GoalStatus.achieved;
      } else if (goal.status === GoalStatus.achieved && newTotal.lessThan(goal.targetAmount)) {
        newStatus = GoalStatus.active;
      }

      await tx.financialGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: newTotal,
          status: newStatus,
        },
      });

      // Clean up linked auto-transfer transaction if applicable
      if (linkedTxnId) {
        const txn = await tx.transaction.findFirst({
          where: { id: linkedTxnId, userId },
        });
        if (txn && txn.type === TxnType.transfer) {
          // Reverse account balances via TransactionService inside this transaction
          // Or delete the transfer transaction
          await tx.transaction.delete({ where: { id: linkedTxnId } });

          // Recompute affected account balances
          const accountsToRecompute = [txn.accountId, txn.transferAccountId].filter(Boolean) as string[];
          for (const accId of accountsToRecompute) {
            const acc = await tx.account.findUnique({ where: { id: accId } });
            if (acc) {
              const [inc, exp, tOut, tIn] = await Promise.all([
                tx.transaction.aggregate({ where: { accountId: accId, type: TxnType.income }, _sum: { amount: true } }),
                tx.transaction.aggregate({ where: { accountId: accId, type: TxnType.expense }, _sum: { amount: true } }),
                tx.transaction.aggregate({ where: { accountId: accId, type: TxnType.transfer }, _sum: { amount: true } }),
                tx.transaction.aggregate({ where: { transferAccountId: accId, type: TxnType.transfer }, _sum: { amount: true } }),
              ]);
              const income = inc._sum.amount || new Prisma.Decimal(0);
              const expense = exp._sum.amount || new Prisma.Decimal(0);
              const transferOut = tOut._sum.amount || new Prisma.Decimal(0);
              const transferIn = tIn._sum.amount || new Prisma.Decimal(0);

              const balance = acc.openingBalance.add(income).sub(expense).sub(transferOut).add(transferIn);
              await tx.account.update({ where: { id: accId }, data: { currentBalance: balance } });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'goal.contribution.delete',
          entityType: 'goal',
          entityId: goalId,
          metadata: {
            contributionId,
            reversedAmount: contrib.amount.toNumber(),
            newTotal: newTotal.toNumber(),
          },
        },
      });

      return { success: true };
    });
  }

  /**
   * Returns top active goals for Dashboard integration.
   */
  static async getActiveGoalsForDashboard(userId: string, limit: number = 4) {
    const goals = await prisma.financialGoal.findMany({
      where: { userId, status: { not: GoalStatus.archived } },
      orderBy: [{ status: 'asc' }, { targetDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
        icon: true,
        color: true,
        status: true,
        createdAt: true,
      },
    });

    const now = new Date();
    return goals.map((g) => {
      const targetNum = g.targetAmount.toNumber();
      const currentNum = g.currentAmount.toNumber();
      const remainingNum = Math.max(0, targetNum - currentNum);

      let percentage = 0;
      if (g.targetAmount.greaterThan(0)) {
        const rawPct = g.currentAmount.div(g.targetAmount).mul(100).toNumber();
        percentage = Math.round(rawPct * 100) / 100;
      }

      const dynamicStatus = GoalService.calculateDynamicStatus(
        g.status,
        g.targetAmount,
        g.currentAmount,
        g.targetDate,
        g.createdAt,
        now
      );

      return {
        id: g.id,
        name: g.name,
        targetAmount: targetNum,
        currentAmount: currentNum,
        remainingAmount: remainingNum,
        percentage,
        targetDate: g.targetDate ? format(g.targetDate, 'dd MMM yyyy') : null,
        status: dynamicStatus,
        icon: g.icon,
        color: g.color,
      };
    });
  }
}
