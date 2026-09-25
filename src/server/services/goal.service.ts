import prisma from '@/server/db/prisma';
import { CreateGoalInput, UpdateGoalInput, ContributeGoalInput } from '@/lib/validation/goal.schema';
import { GoalStatus, Prisma, NotifType } from '@prisma/client';

export class GoalService {
  /**
   * Lists all goals for a user with calculated progress.
   */
  static async list(userId: string) {
    const goals = await prisma.financialGoal.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        contributions: {
          include: {
            transaction: {
              select: { id: true, description: true, occurredAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ status: 'asc' }, { targetDate: 'asc' }],
    });

    return goals.map((g) => {
      const target = g.targetAmount.toNumber();
      const current = g.currentAmount.toNumber();
      const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
      const remaining = Math.max(0, target - current);

      return {
        ...g,
        targetAmountNum: target,
        currentAmountNum: current,
        percentage,
        remaining,
      };
    });
  }

  /**
   * Retrieves single goal owned by user.
   */
  static async getById(userId: string, goalId: string) {
    return prisma.financialGoal.findFirst({
      where: { id: goalId, userId },
      include: {
        account: true,
        contributions: {
          include: {
            transaction: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Creates a new financial goal.
   */
  static async create(userId: string, input: CreateGoalInput) {
    return prisma.financialGoal.create({
      data: {
        userId,
        name: input.name,
        targetAmount: new Prisma.Decimal(input.targetAmount),
        currentAmount: new Prisma.Decimal(0),
        targetDate: input.targetDate || null,
        accountId: input.accountId || null,
        icon: input.icon || 'Target',
        color: input.color || '#10b981',
        status: GoalStatus.active,
      },
    });
  }

  /**
   * Updates a financial goal.
   */
  static async update(userId: string, goalId: string, input: UpdateGoalInput) {
    const goal = await this.getById(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found.');
    }

    return prisma.financialGoal.update({
      where: { id: goalId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.targetAmount && { targetAmount: new Prisma.Decimal(input.targetAmount) }),
        ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
        ...(input.accountId !== undefined && { accountId: input.accountId }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.status && { status: input.status }),
      },
    });
  }

  /**
   * Archives a goal.
   */
  static async archive(userId: string, goalId: string) {
    return this.update(userId, goalId, { status: GoalStatus.archived });
  }

  /**
   * Deletes a goal.
   */
  static async delete(userId: string, goalId: string) {
    const goal = await this.getById(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found.');
    }

    return prisma.financialGoal.delete({
      where: { id: goalId },
    });
  }

  /**
   * Contributes to a goal by linking a transaction owned by the user.
   * Enforces cross-user isolation and transaction amount boundary.
   */
  static async contribute(userId: string, input: ContributeGoalInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify goal exists and is owned by userId
      const goal = await tx.financialGoal.findFirst({
        where: { id: input.goalId, userId },
      });
      if (!goal) {
        throw new Error('Goal not found or access denied.');
      }

      // 2. Verify transaction exists and is owned by userId
      const txn = await tx.transaction.findFirst({
        where: { id: input.transactionId, userId },
      });
      if (!txn) {
        throw new Error('Transaction not found or access denied.');
      }

      // 3. Contribution amount must not exceed transaction amount
      const contribDecimal = new Prisma.Decimal(input.amount);
      if (contribDecimal.greaterThan(txn.amount)) {
        throw new Error(
          `Contribution amount (Rs. ${contribDecimal.toString()}) cannot exceed transaction amount (Rs. ${txn.amount.toString()}).`
        );
      }

      // 4. Create contribution record (1:1 with transaction in v1)
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: goal.id,
          transactionId: txn.id,
          amount: contribDecimal,
        },
      });

      // 5. Recompute goal's current_amount from contributions
      const sumAgg = await tx.goalContribution.aggregate({
        where: { goalId: goal.id },
        _sum: { amount: true },
      });
      const newTotal = sumAgg._sum.amount || new Prisma.Decimal(0);

      // Check if goal achieved
      let newStatus = goal.status;
      if (newTotal.greaterThanOrEqualTo(goal.targetAmount)) {
        newStatus = GoalStatus.achieved;
      }

      await tx.financialGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: newTotal,
          status: newStatus,
        },
      });

      // 6. Milestone & Achievement notifications
      if (newStatus === GoalStatus.achieved && goal.status !== GoalStatus.achieved) {
        await tx.notification.create({
          data: {
            userId,
            type: NotifType.goal_achieved,
            title: `Goal Achieved: ${goal.name}! 🎉`,
            body: `Congratulations! You reached your target of Rs. ${goal.targetAmount.toFixed(2)}.`,
            linkUrl: '/goals',
          },
        });
      } else {
        const pct = newTotal.div(goal.targetAmount).mul(100).toNumber();
        if (pct >= 50 && goal.currentAmount.div(goal.targetAmount).mul(100).toNumber() < 50) {
          await tx.notification.create({
            data: {
              userId,
              type: NotifType.goal_milestone,
              title: `Halfway milestone reached: ${goal.name}`,
              body: `You have reached 50% of your savings goal (Rs. ${newTotal.toFixed(2)}).`,
              linkUrl: '/goals',
            },
          });
        }
      }

      return contribution;
    });
  }
}
