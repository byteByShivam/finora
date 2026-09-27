'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building,
  CreditCard,
  TrendingUp,
  Wallet,
  Coins,
  Landmark,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Search,
  Layers,
  Percent,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AccountModal } from '@/components/accounts/account-modal';
import { toggleArchiveAccountAction, deleteAccountAction } from '@/app/actions/account.actions';
import { AccountType, TxnType } from '@prisma/client';
import { formatCurrency } from '@/lib/money';

export interface SerializedTransaction {
  id: string;
  userId: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  type: TxnType;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  occurredAt: string;
  isReconciled: boolean;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  transferAccount: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  account: {
    id: string;
    name: string;
  };
}

export interface SerializedAccountDetail {
  account: {
    id: string;
    userId: string;
    name: string;
    type: AccountType;
    currency: string;
    openingBalance: number;
    currentBalance: number;
    creditLimit: number | null;
    color: string | null;
    icon: string | null;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    openingBalance: number;
    currentBalance: number;
    totalIncome: number;
    totalExpense: number;
    totalTransferIn: number;
    totalTransferOut: number;
    totalInflows: number;
    totalOutflows: number;
    netChange: number;
    transactionCount: number;
    creditUtilizationPct: number | null;
  };
  recentTransactions: SerializedTransaction[];
}

interface AccountDetailViewProps {
  accountDetail: SerializedAccountDetail;
  currency: string;
}

export function AccountDetailView({ accountDetail, currency }: AccountDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const { account, stats, recentTransactions } = accountDetail;
  const isCreditCard = account.type === AccountType.credit_card;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      // Search query filter (matches description or category name or notes)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const descMatch = tx.description?.toLowerCase().includes(query) ?? false;
        const noteMatch = tx.notes?.toLowerCase().includes(query) ?? false;
        const catMatch = tx.category?.name.toLowerCase().includes(query) ?? false;
        return descMatch || noteMatch || catMatch;
      }
      return true;
    });
  }, [recentTransactions, typeFilter, searchQuery]);

  const handleToggleArchive = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleArchiveAccountAction(account.id, !account.isArchived);
      if (!res.success) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    if (stats.transactionCount > 0) {
      setError(
        `Cannot delete "${account.name}" because it contains ${stats.transactionCount} transaction(s). Please archive it instead.`
      );
      return;
    }

    if (confirm(`Are you sure you want to delete "${account.name}"? This cannot be undone.`)) {
      startTransition(async () => {
        const res = await deleteAccountAction(account.id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.push('/accounts');
        }
      });
    }
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.bank:
        return <Building className="h-6 w-6" />;
      case AccountType.credit_card:
        return <CreditCard className="h-6 w-6" />;
      case AccountType.investment:
        return <TrendingUp className="h-6 w-6" />;
      case AccountType.wallet:
        return <Wallet className="h-6 w-6" />;
      case AccountType.cash:
        return <Coins className="h-6 w-6" />;
      default:
        return <Landmark className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Accounts</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Action Blocked</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Account Identity & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm shrink-0"
            style={{ backgroundColor: account.color || '#2563eb' }}
          >
            {getAccountIcon(account.type)}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{account.name}</h1>
              {account.isArchived && (
                <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50 border-amber-200 font-medium">
                  Archived
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[11px] uppercase font-mono tracking-wider text-slate-600">
                {account.type.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-mono">Currency: {account.currency || currency}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleArchive}
            disabled={isPending}
            className="gap-1.5 text-xs text-slate-700"
          >
            {account.isArchived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            title={stats.transactionCount > 0 ? 'Cannot delete: contains transactions' : 'Delete account'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <Card className="p-4 border-slate-200 shadow-sm relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: account.color || '#2563eb' }}
          />
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{isCreditCard ? 'Outstanding Balance' : 'Current Balance'}</span>
            <Landmark className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {formatCurrency(stats.currentBalance, account.currency || currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Opening:{' '}
            <span className="font-mono text-slate-600 font-medium">
              {formatCurrency(stats.openingBalance, account.currency || currency)}
            </span>
          </p>
        </Card>

        {/* Total Inflows */}
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Inflows</span>
            <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-xl font-bold font-mono tracking-tight text-emerald-600 mt-2">
            +{formatCurrency(stats.totalInflows, account.currency || currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Income & transfers in ({stats.totalTransferIn > 0 ? `incl. transfers` : 'direct income'})
          </p>
        </Card>

        {/* Total Outflows */}
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Outflows</span>
            <div className="h-6 w-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-xl font-bold font-mono tracking-tight text-rose-600 mt-2">
            -{formatCurrency(stats.totalOutflows, account.currency || currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Expenses & transfers out
          </p>
        </Card>

        {/* Net Change or Credit Utilization */}
        {isCreditCard && account.creditLimit ? (
          <Card className="p-4 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Credit Utilization</span>
              <Percent className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              {stats.creditUtilizationPct !== null ? `${stats.creditUtilizationPct.toFixed(1)}%` : 'N/A'}
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  (stats.creditUtilizationPct || 0) > 80
                    ? 'bg-rose-500'
                    : (stats.creditUtilizationPct || 0) > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(stats.creditUtilizationPct || 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Limit: {formatCurrency(account.creditLimit, account.currency || currency)}
            </p>
          </Card>
        ) : (
          <Card className="p-4 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Net Movement</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <p
              className={`text-xl font-bold font-mono tracking-tight mt-2 ${
                stats.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {stats.netChange >= 0 ? '+' : ''}
              {formatCurrency(stats.netChange, account.currency || currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {stats.transactionCount} total transaction{stats.transactionCount === 1 ? '' : 's'} recorded
            </p>
          </Card>
        )}
      </div>

      {/* Account Transactions Ledger */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Account Transaction History
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Ledger transactions affecting this account balance ({recentTransactions.length} shown)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 px-2.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Types</option>
              <option value={TxnType.income}>Income (+)</option>
              <option value={TxnType.expense}>Expense (-)</option>
              <option value={TxnType.transfer}>Transfers</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <Landmark className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">No transactions recorded yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Transactions associated with this account will automatically sync and update the balance here.
              </p>
              <div className="mt-4">
                <Link href="/transactions">
                  <Button size="sm" variant="outline" className="text-xs">
                    Go to Transactions
                  </Button>
                </Link>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center border-t border-slate-100">
              <p className="text-xs text-slate-500">No transactions match your current search or type filter.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                }}
              >
                Reset Filter
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-y border-slate-200/80 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category / Direction</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const isOutboundTransfer =
                      tx.type === TxnType.transfer && tx.accountId === account.id;
                    const isInboundTransfer =
                      tx.type === TxnType.transfer && tx.transferAccountId === account.id;
                    const dateObj = new Date(tx.occurredAt);
                    const formattedDate = dateObj.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-mono">
                          {formattedDate}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {tx.description || 'Untitled Transaction'}
                          </div>
                          {tx.notes && (
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {tx.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === TxnType.transfer ? (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              {isOutboundTransfer ? (
                                <>
                                  <span className="text-slate-400">To:</span>
                                  <span className="font-medium text-slate-800">
                                    {tx.transferAccount?.name || 'Linked Account'}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-sky-500" />
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-400">From:</span>
                                  <span className="font-medium text-slate-800">
                                    {tx.account?.name || 'Source Account'}
                                  </span>
                                  <ArrowLeft className="h-3 w-3 text-sky-500" />
                                </>
                              )}
                            </div>
                          ) : tx.category ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: tx.category.color || '#64748b' }}
                              />
                              <span className="text-slate-700 font-medium">
                                {tx.category.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Uncategorized</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === TxnType.income ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                              Income
                            </Badge>
                          ) : tx.type === TxnType.expense ? (
                            <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 border-rose-200">
                              Expense
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-sky-700 bg-sky-50 border-sky-200">
                              Transfer
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold">
                          {tx.type === TxnType.income || isInboundTransfer ? (
                            <span className="text-emerald-600">
                              +{formatCurrency(tx.amount, tx.currency || account.currency || currency)}
                            </span>
                          ) : (
                            <span className="text-rose-600">
                              -{formatCurrency(tx.amount, tx.currency || account.currency || currency)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Account Modal */}
      <AccountModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currency={account.currency || currency}
        account={{
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          openingBalance: account.openingBalance,
          creditLimit: account.creditLimit,
          color: account.color,
          icon: account.icon,
        }}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
