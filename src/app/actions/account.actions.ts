'use server';

import { requireUser } from '@/server/auth/session';
import {
  createAccountSchema,
  updateAccountSchema,
  CreateAccountInput,
  UpdateAccountInput,
} from '@/lib/validation/account.schema';
import { AccountService } from '@/server/services/account.service';
import prisma from '@/server/db/prisma';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { Account } from '@prisma/client';

export async function createAccountAction(rawInput: CreateAccountInput): Promise<ActionResult<Account>> {
  try {
    const user = await requireUser();
    const parsed = createAccountSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const account = await AccountService.create(user.id, parsed.data);
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    return { success: true, data: account };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create account.';
    return { success: false, error: message };
  }
}

export async function updateAccountAction(
  accountId: string,
  rawInput: UpdateAccountInput
): Promise<ActionResult<Account>> {
  try {
    const user = await requireUser();
    const parsed = updateAccountSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
    }

    const updated = await AccountService.update(user.id, accountId, parsed.data);
    revalidatePath('/accounts');
    revalidatePath(`/accounts/${accountId}`);
    revalidatePath('/dashboard');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update account.';
    return { success: false, error: message };
  }
}

export async function toggleArchiveAccountAction(
  accountId: string,
  isArchived: boolean
): Promise<ActionResult<Account>> {
  try {
    const user = await requireUser();
    const updated = await AccountService.toggleArchive(user.id, accountId, isArchived);
    revalidatePath('/accounts');
    revalidatePath(`/accounts/${accountId}`);
    revalidatePath('/dashboard');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive account.';
    return { success: false, error: message };
  }
}

export async function deleteAccountAction(accountId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await AccountService.delete(user.id, accountId);

    // Audit logging for sensitive account deletion per finora-architecture.md §9
    try {
      const headerList = await headers();
      const ip = headerList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      const userAgent = headerList.get('user-agent') || 'Unknown';

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'account.delete',
          entityType: 'Account',
          entityId: accountId,
          ipAddress: ip,
          userAgent,
        },
      });
    } catch {
      // Audit log non-blocking fallback
    }

    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete account.';
    return { success: false, error: message };
  }
}
