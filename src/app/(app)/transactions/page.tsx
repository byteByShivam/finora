import { requireUser } from '@/server/auth/session';
import { TransactionService } from '@/server/services/transaction.service';
import { AccountService } from '@/server/services/account.service';
import { CategoryService } from '@/server/services/category.service';
import { TransactionsView } from '@/components/transactions/transactions-view';
import { TxnType } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    account?: string;
    category?: string;
    type?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10) || 1;
  const filters = {
    accountId: params.account,
    categoryId: params.category,
    type: params.type as TxnType | undefined,
    search: params.search,
    page,
    pageSize: 20,
  };

  const [data, accountsRaw, categoriesRaw] = await Promise.all([
    TransactionService.list(user.id, filters),
    AccountService.list(user.id),
    CategoryService.list(user.id),
  ]);

  const accounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));

  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return (
    <TransactionsView
      initialData={data}
      accounts={accounts}
      categories={categories}
      currency={user.currency}
    />
  );
}
