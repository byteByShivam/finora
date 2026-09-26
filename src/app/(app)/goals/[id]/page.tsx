import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { GoalService } from '@/server/services/goal.service';
import { AccountService } from '@/server/services/account.service';
import { GoalDetailView } from '@/components/goals/goal-detail-view';

interface GoalDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const [detail, accountsRaw] = await Promise.all([
    GoalService.getById(user.id, id),
    AccountService.list(user.id),
  ]);

  if (!detail) {
    notFound();
  }

  const accounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <GoalDetailView
      detail={detail}
      accounts={accounts}
      currency={user.currency}
    />
  );
}
