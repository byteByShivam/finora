'use server';

import { requireUser } from '@/server/auth/session';
import {
  createGoalSchema,
  updateGoalSchema,
  addContributionSchema,
  updateContributionSchema,
  CreateGoalInput,
  UpdateGoalInput,
  AddContributionInput,
  UpdateContributionInput,
} from '@/lib/validation/goal.schema';
import { GoalService } from '@/server/services/goal.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { FinancialGoal, GoalContribution } from '@prisma/client';

export async function createGoalAction(rawInput: CreateGoalInput): Promise<ActionResult<FinancialGoal>> {
  try {
    const user = await requireUser();
    const parsed = createGoalSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid goal data.' };
    }

    const goal = await GoalService.create(user.id, parsed.data);
    revalidatePath('/goals');
    revalidatePath('/dashboard');
    return { success: true, data: goal };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create goal.';
    return { success: false, error: message };
  }
}

export async function updateGoalAction(
  goalId: string,
  rawInput: UpdateGoalInput
): Promise<ActionResult<FinancialGoal>> {
  try {
    const user = await requireUser();
    const parsed = updateGoalSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid goal update data.' };
    }

    const updated = await GoalService.update(user.id, goalId, parsed.data);
    revalidatePath('/goals');
    revalidatePath(`/goals/${goalId}`);
    revalidatePath('/dashboard');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update goal.';
    return { success: false, error: message };
  }
}

export async function archiveGoalAction(goalId: string): Promise<ActionResult<FinancialGoal>> {
  try {
    const user = await requireUser();
    const archived = await GoalService.archive(user.id, goalId);
    revalidatePath('/goals');
    revalidatePath(`/goals/${goalId}`);
    revalidatePath('/dashboard');
    return { success: true, data: archived };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive goal.';
    return { success: false, error: message };
  }
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await GoalService.delete(user.id, goalId);
    revalidatePath('/goals');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete goal.';
    return { success: false, error: message };
  }
}

export async function addContributionAction(
  rawInput: AddContributionInput
): Promise<ActionResult<GoalContribution>> {
  try {
    const user = await requireUser();
    const parsed = addContributionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid contribution data.' };
    }

    const contrib = await GoalService.addContribution(user.id, parsed.data.goalId, parsed.data);
    revalidatePath('/goals');
    revalidatePath(`/goals/${parsed.data.goalId}`);
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
    return { success: true, data: contrib };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to contribute to goal.';
    return { success: false, error: message };
  }
}

// Backward-compatible alias
export const contributeGoalAction = addContributionAction;

export async function updateContributionAction(
  goalId: string,
  contributionId: string,
  rawInput: UpdateContributionInput
): Promise<ActionResult<GoalContribution>> {
  try {
    const user = await requireUser();
    const parsed = updateContributionSchema.safeParse({ ...rawInput, id: contributionId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid contribution update data.' };
    }

    const updated = await GoalService.updateContribution(user.id, goalId, contributionId, parsed.data);
    revalidatePath('/goals');
    revalidatePath(`/goals/${goalId}`);
    revalidatePath('/dashboard');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update contribution.';
    return { success: false, error: message };
  }
}

export async function deleteContributionAction(
  goalId: string,
  contributionId: string
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await GoalService.deleteContribution(user.id, goalId, contributionId);
    revalidatePath('/goals');
    revalidatePath(`/goals/${goalId}`);
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete contribution.';
    return { success: false, error: message };
  }
}
