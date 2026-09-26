'use server';

import { requireUser } from '@/server/auth/session';
import {
  createRecurringSchema,
  updateRecurringSchema,
  CreateRecurringInput,
  UpdateRecurringInput,
} from '@/lib/validation/recurring.schema';
import { RecurringService } from '@/server/services/recurring.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { RecurringTransaction } from '@prisma/client';

export async function createRecurringAction(rawInput: CreateRecurringInput): Promise<ActionResult<RecurringTransaction>> {
  try {
    const user = await requireUser();
    const parsed = createRecurringSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid recurring data.' };
    }

    const item = await RecurringService.create(user.id, parsed.data);
    revalidatePath('/recurring');
    revalidatePath('/dashboard');
    return { success: true, data: item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create recurring transaction.';
    return { success: false, error: message };
  }
}

export async function updateRecurringAction(
  recurringId: string,
  rawInput: UpdateRecurringInput
): Promise<ActionResult<RecurringTransaction>> {
  try {
    const user = await requireUser();
    const parsed = updateRecurringSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input.' };
    }

    const updated = await RecurringService.update(user.id, recurringId, parsed.data);
    revalidatePath('/recurring');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update recurring schedule.';
    return { success: false, error: message };
  }
}

export async function toggleActiveRecurringAction(
  recurringId: string,
  isActive: boolean
): Promise<ActionResult<RecurringTransaction>> {
  try {
    const user = await requireUser();
    const updated = await RecurringService.toggleActive(user.id, recurringId, isActive);
    revalidatePath('/recurring');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update recurring status.';
    return { success: false, error: message };
  }
}

export async function deleteRecurringAction(recurringId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await RecurringService.delete(user.id, recurringId);
    revalidatePath('/recurring');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete recurring schedule.';
    return { success: false, error: message };
  }
}

export async function runCatchUpAction(): Promise<ActionResult<{ generatedCount: number }>> {
  try {
    const user = await requireUser();
    const count = await RecurringService.processCatchUp(user.id);
    revalidatePath('/recurring');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath('/budgets');
    return { success: true, data: { generatedCount: count } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process recurring transactions.';
    return { success: false, error: message };
  }
}
