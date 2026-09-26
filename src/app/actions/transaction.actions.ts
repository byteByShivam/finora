'use server';

import { requireUser } from '@/server/auth/session';
import {
  createTransactionSchema,
  updateTransactionSchema,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/lib/validation/transaction.schema';
import { TransactionService } from '@/server/services/transaction.service';
import { BudgetService } from '@/server/services/budget.service';
import { TxnType, Transaction } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';

export async function createTransactionAction(
  rawInput: CreateTransactionInput
): Promise<ActionResult<Transaction>> {
  try {
    const user = await requireUser();
    const parsed = createTransactionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid transaction data.',
      };
    }

    const txn = await TransactionService.create(user.id, parsed.data);

    // If expense, check budget threshold alert asynchronously
    if (parsed.data.type === TxnType.expense && parsed.data.categoryId) {
      await BudgetService.checkThresholdAlert(
        user.id,
        parsed.data.categoryId,
        parsed.data.occurredAt
      ).catch(() => {});
    }

    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath(`/accounts/${parsed.data.accountId}`);
    if (parsed.data.transferAccountId) {
      revalidatePath(`/accounts/${parsed.data.transferAccountId}`);
    }
    revalidatePath('/budgets');
    revalidatePath('/analytics');

    return { success: true, data: txn };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record transaction.';
    return { success: false, error: message };
  }
}

export async function updateTransactionAction(
  transactionId: string,
  rawInput: UpdateTransactionInput
): Promise<ActionResult<Transaction>> {
  try {
    const user = await requireUser();
    const parsed = updateTransactionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid input.',
      };
    }

    const updated = await TransactionService.update(user.id, transactionId, parsed.data);

    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath(`/accounts/${updated.accountId}`);
    if (updated.transferAccountId) {
      revalidatePath(`/accounts/${updated.transferAccountId}`);
    }
    revalidatePath('/budgets');
    revalidatePath('/analytics');

    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update transaction.';
    return { success: false, error: message };
  }
}

export async function deleteTransactionAction(
  transactionId: string
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await TransactionService.delete(user.id, transactionId);

    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath('/budgets');
    revalidatePath('/analytics');

    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete transaction.';
    return { success: false, error: message };
  }
}
