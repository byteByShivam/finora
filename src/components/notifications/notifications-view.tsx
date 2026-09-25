'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Award,
  Repeat,
  ShieldAlert,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
} from '@/app/actions/notification.actions';
import { formatDateTime } from '@/lib/dates';
import { NotifType } from '@prisma/client';

interface NotificationItem {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationsViewProps {
  notifications: NotificationItem[];
}

export function NotificationsView({ notifications }: NotificationsViewProps) {
  const [isPending, startTransition] = useTransition();

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteNotificationAction(id);
    });
  };

  const getIcon = (type: NotifType) => {
    switch (type) {
      case NotifType.budget_alert:
      case NotifType.budget_exceeded:
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case NotifType.goal_milestone:
      case NotifType.goal_achieved:
        return <Award className="h-5 w-5 text-emerald-600" />;
      case NotifType.recurring_due:
      case NotifType.recurring_failed:
        return <Repeat className="h-5 w-5 text-blue-600" />;
      case NotifType.security:
        return <ShieldAlert className="h-5 w-5 text-rose-600" />;
      default:
        return <Info className="h-5 w-5 text-slate-600" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Budget alerts, recurring item notifications, and goal milestone achievements
          </p>
        </div>

        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} isLoading={isPending}>
            <CheckCheck className="h-4 w-4 mr-1.5" />
            <span>Mark All as Read ({unreadCount})</span>
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="There are no pending alerts or milestone updates in your notifications queue."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                !n.isRead ? 'bg-emerald-50/20' : 'hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-slate-100 shrink-0 mt-0.5">{getIcon(n.type)}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                    )}
                  </div>
                  {n.body && <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>}
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.linkUrl && (
                      <Link
                        href={n.linkUrl}
                        className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    disabled={isPending}
                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  disabled={isPending}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
