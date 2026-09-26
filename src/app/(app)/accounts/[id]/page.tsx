import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { AccountService } from '@/server/services/account.service';
import { AccountDetailView } from '@/components/accounts/account-detail-view';

export const dynamic = 'force-dynamic';

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await AccountService.getAccountDetail(user.id, id);

  if (!detail) {
    notFound();
  }

  // Pure server-side pre-computation: serialize Decimal objects into safe primitives for Client Component
  const serialized = {
    account: {
      ...detail.account,
      openingBalance: detail.account.openingBalance.toNumber(),
      currentBalance: detail.account.currentBalance.toNumber(),
      creditLimit: detail.account.creditLimit ? detail.account.creditLimit.toNumber() : null,
      createdAt: detail.account.createdAt.toISOString(),
      updatedAt: detail.account.updatedAt.toISOString(),
    },
    stats: {
      openingBalance: detail.stats.openingBalance.toNumber(),
      currentBalance: detail.stats.currentBalance.toNumber(),
      totalIncome: detail.stats.totalIncome.toNumber(),
      totalExpense: detail.stats.totalExpense.toNumber(),
      totalTransferIn: detail.stats.totalTransferIn.toNumber(),
      totalTransferOut: detail.stats.totalTransferOut.toNumber(),
      totalInflows: detail.stats.totalInflows.toNumber(),
      totalOutflows: detail.stats.totalOutflows.toNumber(),
      netChange: detail.stats.netChange.toNumber(),
      transactionCount: detail.stats.transactionCount,
      creditUtilizationPct: detail.stats.creditUtilizationPct,
    },
    recentTransactions: detail.recentTransactions.map((tx) => ({
      ...tx,
      amount: tx.amount.toNumber(),
      occurredAt: tx.occurredAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    })),
  };

  return <AccountDetailView accountDetail={serialized} currency={user.currency} />;
}
