import { requireUser } from '@/server/auth/session';
import { NotificationService } from '@/server/services/notification.service';
import { NotificationsView } from '@/components/notifications/notifications-view';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await NotificationService.list(user.id);

  return <NotificationsView notifications={notifications} />;
}
