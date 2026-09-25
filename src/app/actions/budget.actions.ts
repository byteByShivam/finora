'use server';

import { requireUser } from '@/server/auth/session';
import { upsertBudgetSchema, UpsertBudgetInput } from '@/lib/validation/budget.schema';
import { BudgetService } from '@/server/services/budget.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { Budget } from '@prisma/client';

export async function upsertBudgetAction(rawInput: UpsertBudgetInput): Promise<ActionResult<Budget>> {
  try {
    const user = await requireUser();
    const parsed = upsertBudgetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid budget data.' };
    }

    const budget = await BudgetService.upsert(user.id, parsed.data);
    revalidatePath('/budgets');
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
    await BudgetService.delete(user.id, budgetId);
    revalidatePath('/budgets');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete budget.';
    return { success: false, error: message };
  }
}
