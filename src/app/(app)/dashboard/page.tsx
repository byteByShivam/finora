import { requireUser } from '@/server/auth/session';
import { AnalyticsService } from '@/server/services/analytics.service';
import { AccountService } from '@/server/services/account.service';
import { CategoryService } from '@/server/services/category.service';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const [snapshot, rawAccounts, rawCategories] = await Promise.all([
    AnalyticsService.getDashboardSnapshot(user.id, {
      period: params.period,
      from: params.from,
      to: params.to,
    }),
    AccountService.list(user.id, { isArchived: false }),
    CategoryService.list(user.id),
  ]);

  const accounts = rawAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));

  const categories = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
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
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
