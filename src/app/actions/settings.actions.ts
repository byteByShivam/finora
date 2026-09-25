'use server';

import { requireUser, clearSessionCookie } from '@/server/auth/session';
import { AuthService } from '@/server/auth/auth.service';
import { changePasswordSchema, ChangePasswordInput } from '@/lib/validation/auth.schema';
import prisma from '@/server/db/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ActionResult } from '@/types/actions';

const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(120),
    currency: z.string().length(3),
    timezone: z.string().min(1),
  })
  .strict();

export async function updateProfileAction(rawInput: {
  name: string;
  currency: string;
  timezone: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateProfileSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input.' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile.';
    return { success: false, error: message };
  }
}

export async function changePasswordAction(rawInput: ChangePasswordInput): Promise<ActionResult> {
  try {
    const sessionUser = await requireUser();
    const parsed = changePasswordSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid password format.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user || !user.passwordHash) {
      return { success: false, error: 'User account not found.' };
    }

    const isValid = await AuthService.verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const newHash = await AuthService.hashPassword(parsed.data.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Revoke all other active sessions for this user for security
      await tx.session.deleteMany({
        where: { userId: user.id },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'user.password_change',
          entityType: 'User',
          entityId: user.id,
        },
      });
    });

    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to change password.';
    return { success: false, error: message };
  }
}

export async function deleteAccountAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();

    await prisma.user.delete({
      where: { id: user.id },
    });

    await clearSessionCookie();
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete account.';
    return { success: false, error: message };
  }
}
