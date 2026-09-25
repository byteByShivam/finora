import { requireUser } from '@/server/auth/session';
import { RecurringService } from '@/server/services/recurring.service';
import { AccountService } from '@/server/services/account.service';
import { CategoryService } from '@/server/services/category.service';
import { RecurringView } from '@/components/recurring/recurring-view';

export const dynamic = 'force-dynamic';

export default async function RecurringPage() {
  const user = await requireUser();

  const [recurringList, accountsRaw, categoriesRaw] = await Promise.all([
    RecurringService.list(user.id),
    AccountService.list(user.id),
    CategoryService.list(user.id),
  ]);

  const accounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return (
    <RecurringView
      recurringList={recurringList}
      accounts={accounts}
      categories={categories}
      currency={user.currency}
    />
  );
}
