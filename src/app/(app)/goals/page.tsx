import { requireUser } from '@/server/auth/session';
import { GoalService } from '@/server/services/goal.service';
import { AccountService } from '@/server/services/account.service';
import prisma from '@/server/db/prisma';
import { GoalsView } from '@/components/goals/goals-view';
import { TxnType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const user = await requireUser();

  const [goals, accountsRaw, transactionsRaw] = await Promise.all([
    GoalService.list(user.id),
    AccountService.list(user.id),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        // Eligible transactions that haven't been linked to a goal contribution yet
        goalContribution: null,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    }),
  ]);

  const accounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const transactions = transactionsRaw.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount.toNumber(),
    occurredAt: t.occurredAt,
  }));

  return (
    <GoalsView
      goals={goals}
      accounts={accounts}
      transactions={transactions}
      currency={user.currency}
    />
  );
}
