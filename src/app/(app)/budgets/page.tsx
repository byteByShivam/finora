import { requireUser } from '@/server/auth/session';
import { BudgetService } from '@/server/services/budget.service';
import { CategoryService } from '@/server/services/category.service';
import { BudgetsView } from '@/components/budgets/budgets-view';
import { CategoryType, BudgetPeriod } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface BudgetsPageProps {
  searchParams: Promise<{
    period?: string;
    date?: string;
  }>;
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const activePeriod = params.period === 'yearly' ? BudgetPeriod.yearly : BudgetPeriod.monthly;
  const targetDate = params.date ? new Date(params.date) : new Date();

  const [budgets, rawCategories] = await Promise.all([
    BudgetService.getForPeriod(user.id, targetDate, activePeriod),
    CategoryService.list(user.id),
  ]);

  const summary = BudgetService.getSummaryStats(budgets);

  const expenseCategories = rawCategories
    .filter((c) => c.type === CategoryType.expense)
    .map((c) => ({
      id: c.id,
      name: c.name,
    }));

  return (
    <BudgetsView
      budgets={budgets}
      summary={summary}
      categories={expenseCategories}
      currency={user.currency}
      activePeriod={activePeriod}
      selectedDateStr={targetDate.toISOString()}
    />
  );
}
