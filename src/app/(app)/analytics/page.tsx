import { requireUser } from '@/server/auth/session';
import { AnalyticsService } from '@/server/services/analytics.service';
import { AnalyticsView } from '@/components/analytics/analytics-view';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await requireUser();
  const data = await AnalyticsService.getAnalytics(user.id);

  return <AnalyticsView data={data} currency={user.currency} />;
}
