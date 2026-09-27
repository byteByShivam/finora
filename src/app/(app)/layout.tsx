import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { NotificationService } from '@/server/services/notification.service';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Unread notification count scoped to session userId via service layer
  const unreadCount = await NotificationService.getUnreadCount(user.id);

  return (
    <AppShell user={user} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
