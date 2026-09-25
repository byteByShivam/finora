import { requireUser } from '@/server/auth/session';
import { AccountService } from '@/server/services/account.service';
import { AccountsView } from '@/components/accounts/accounts-view';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await AccountService.list(user.id);

  return <AccountsView accounts={accounts} currency={user.currency} />;
}
