'use server';

import { requireUser } from '@/server/auth/session';
import {
  createBudgetSchema,
  updateBudgetSchema,
  upsertBudgetSchema,
  CreateBudgetInput,
  UpdateBudgetInput,
  UpsertBudgetInput,
} from '@/lib/validation/budget.schema';
import { BudgetService } from '@/server/services/budget.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { Budget } from '@prisma/client';

export async function createBudgetAction(rawInput: CreateBudgetInput): Promise<ActionResult<Budget>> {
  try {
    const user = await requireUser();
    const parsed = createBudgetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid budget data.' };
    }

    const budget = await BudgetService.create(user.id, parsed.data);
    revalidatePath('/budgets');
    revalidatePath('/dashboard');
    return { success: true, data: budget };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create budget.';
    return { success: false, error: message };
  }
}

export async function updateBudgetAction(
  budgetId: string,
  rawInput: UpdateBudgetInput
): Promise<ActionResult<Budget>> {
  try {
    const user = await requireUser();
    const parsed = updateBudgetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid budget update data.' };
    }

    const budget = await BudgetService.update(user.id, budgetId, parsed.data);
    revalidatePath('/budgets');
    revalidatePath(`/budgets/${budgetId}`);
    revalidatePath('/dashboard');
    return { success: true, data: budget };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update budget.';
    return { success: false, error: message };
  }
}

export async function upsertBudgetAction(rawInput: UpsertBudgetInput): Promise<ActionResult<Budget>> {
  try {
    const user = await requireUser();
    const parsed = upsertBudgetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid budget data.' };
    }

    const budget = await BudgetService.upsert(user.id, parsed.data);
    revalidatePath('/budgets');
    revalidatePath(`/budgets/${budget.id}`);
    revalidatePath('/dashboard');
    return { success: true, data: budget };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save budget.';
    return { success: false, error: message };
  }
}

export async function deleteBudgetAction(budgetId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    if (!budgetId || typeof budgetId !== 'string') {
      return { success: false, error: 'Invalid budget ID.' };
    }

    await BudgetService.delete(user.id, budgetId);
    revalidatePath('/budgets');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete budget.';
    return { success: false, error: message };
  }
}
