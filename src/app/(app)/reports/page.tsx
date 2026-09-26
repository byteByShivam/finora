import { requireUser } from '@/server/auth/session';
import { AnalyticsService } from '@/server/services/analytics.service';
import { ReportsView } from '@/components/reports/reports-view';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await requireUser();
  const snapshot = await AnalyticsService.getDashboardSnapshot(user.id);

  const report = {
    period: `${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())}`,
    totalIncome: snapshot.metrics.periodIncome,
    totalExpense: snapshot.metrics.periodExpense,
    netSavings: snapshot.metrics.netCashFlow,
    savingsRate: snapshot.metrics.savingsRate,
    categoryBreakdown: snapshot.categoryBreakdown,
  };

  return (
    <ReportsView
      user={{ name: user.name, email: user.email, currency: user.currency }}
      report={report}
    />
  );
}
