import { requireUser } from '@/server/auth/session';
import { BudgetService } from '@/server/services/budget.service';
import { CategoryService } from '@/server/services/category.service';
import { BudgetsView } from '@/components/budgets/budgets-view';
import { CategoryType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function BudgetsPage() {
  const user = await requireUser();

  const [budgets, rawCategories] = await Promise.all([
    BudgetService.getForPeriod(user.id, new Date(), 'monthly'),
    CategoryService.list(user.id),
  ]);

  const expenseCategories = rawCategories
    .filter((c) => c.type === CategoryType.expense)
    .map((c) => ({
      id: c.id,
      name: c.name,
    }));

  return (
    <BudgetsView
      budgets={budgets}
      categories={expenseCategories}
      currency={user.currency}
    />
  );
}
