'use client';

import { useState, useTransition } from 'react';
import {
  Landmark,
  Plus,
  Archive,
  ArchiveRestore,
  Trash2,
  CreditCard,
  Wallet,
  Building,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AccountModal } from '@/components/accounts/account-modal';
import { toggleArchiveAccountAction, deleteAccountAction } from '@/app/actions/account.actions';
import { AccountType } from '@prisma/client';

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: any;
  currentBalance: any;
  creditLimit: any;
  color: string | null;
  isArchived: boolean;
}

interface AccountsViewProps {
  accounts: AccountItem[];
  currency: string;
}

export function AccountsView({ accounts, currency }: AccountsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayedAccounts = accounts.filter((a) => (showArchived ? true : !a.isArchived));

  const handleToggleArchive = (id: string, currentArchived: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleArchiveAccountAction(id, !currentArchived);
      if (!res.success) setError(res.error);
    });
  };

  const handleDelete = (id: string, name: string) => {
    setError(null);
    if (confirm(`Are you sure you want to permanently delete "${name}"? Only accounts with 0 transactions can be deleted.`)) {
      startTransition(async () => {
        const res = await deleteAccountAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your bank accounts, credit cards, cash wallets, and investment holdings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Show Archived</span>
          </label>

          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            <span>Add Account</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Account Cards Grid */}
      {displayedAccounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No accounts found"
          description="Create your first bank or cash account to begin tracking transactions and balances."
          actionLabel="Create Account"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedAccounts.map((acc) => {
            const isCard = acc.type === AccountType.credit_card;
            const balanceNum = Number(acc.currentBalance);

            return (
              <Card
                key={acc.id}
                className={`relative overflow-hidden transition-all ${
                  acc.isArchived ? 'opacity-60 bg-slate-50 border-dashed' : 'hover:border-emerald-300'
                }`}
              >
                {/* Colored Top Bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: acc.color || '#3b82f6' }}
                />

                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: acc.color || '#3b82f6' }}
                    >
                      {acc.type === AccountType.bank ? (
                        <Building className="h-5 w-5" />
                      ) : acc.type === AccountType.credit_card ? (
                        <CreditCard className="h-5 w-5" />
                      ) : acc.type === AccountType.investment ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <Wallet className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base truncate max-w-[160px]">{acc.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] mt-1 uppercase font-mono">
                        {acc.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(acc.id, acc.isArchived)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title={acc.isArchived ? 'Restore account' : 'Archive account'}
                    >
                      {acc.isArchived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(acc.id, acc.name)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Current Balance</p>
                    <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
                      {currency} {balanceNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      <span>Opening: </span>
                      <span className="font-mono font-medium text-slate-700">
                        {currency} {Number(acc.openingBalance).toLocaleString()}
                      </span>
                    </div>

                    {isCard && acc.creditLimit && (
                      <div>
                        <span>Limit: </span>
                        <span className="font-mono font-medium text-slate-700">
                          {currency} {Number(acc.creditLimit).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Account Creation Modal */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currency={currency}
      />
    </div>
  );
}
