import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { BudgetService } from '@/server/services/budget.service';
import { CategoryService } from '@/server/services/category.service';
import { BudgetDetailView } from '@/components/budgets/budget-detail-view';
import { CategoryType } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface BudgetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BudgetDetailPage({ params }: BudgetDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const [detail, rawCategories] = await Promise.all([
    BudgetService.getById(user.id, id),
    CategoryService.list(user.id),
  ]);

  if (!detail) {
    notFound();
  }

  const expenseCategories = rawCategories
    .filter((c) => c.type === CategoryType.expense)
    .map((c) => ({
      id: c.id,
      name: c.name,
    }));

  return (
    <BudgetDetailView
      detail={detail}
      currency={user.currency}
      categories={expenseCategories}
    />
  );
}
