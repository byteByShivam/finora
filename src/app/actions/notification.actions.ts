'use server';

import { requireUser } from '@/server/auth/session';
import { NotificationService } from '@/server/services/notification.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await NotificationService.markRead(user.id, notificationId);
    revalidatePath('/notifications');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update notification.';
    return { success: false, error: message };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await NotificationService.markAllRead(user.id);
    revalidatePath('/notifications');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark all as read.';
    return { success: false, error: message };
  }
}

export async function deleteNotificationAction(notificationId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await NotificationService.delete(user.id, notificationId);
    revalidatePath('/notifications');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete notification.';
    return { success: false, error: message };
  }
}
