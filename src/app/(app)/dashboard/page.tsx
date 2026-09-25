import { requireUser } from '@/server/auth/session';
import { AnalyticsService } from '@/server/services/analytics.service';
import { CategoryService } from '@/server/services/category.service';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();

  const [snapshot, rawCategories] = await Promise.all([
    AnalyticsService.getDashboardSnapshot(user.id),
    CategoryService.list(user.id),
  ]);

  const categories = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Overview</h1>
        <p className="text-xs text-slate-500 mt-1">
          Real-time double-entry ledger summaries and active financial targets
        </p>
      </div>

      <DashboardView
        snapshot={snapshot}
        currency={user.currency}
        categories={categories}
      />
    </div>
  );
}
