import prisma from '@/server/db/prisma';

export class NotificationService {
  /**
   * Lists notifications for user, sorted newest first.
   */
  static async list(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Unread notification count.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Marks a single notification as read.
   */
  static async markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Marks all user notifications as read.
   */
  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Deletes a notification.
   */
  static async delete(userId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }
}
