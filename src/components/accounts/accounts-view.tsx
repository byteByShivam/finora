'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Plus,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit2,
  CreditCard,
  Wallet,
  Building,
  TrendingUp,
  AlertCircle,
  Search,
  ExternalLink,
  Coins,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { AccountModal, EditableAccount } from '@/components/accounts/account-modal';
import { toggleArchiveAccountAction, deleteAccountAction } from '@/app/actions/account.actions';
import { AccountType } from '@prisma/client';
import { formatCurrency } from '@/lib/money';

export interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: any;
  currentBalance: any;
  creditLimit: any;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  _count?: {
    transactions: number;
  };
}

interface AccountsViewProps {
  accounts: AccountItem[];
  currency: string;
}

export function AccountsView({ accounts, currency }: AccountsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EditableAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Filter accounts by search query, type, and archive status
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Archive filter
      if (!showArchived && acc.isArchived) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && acc.type !== selectedType) {
        return false;
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        return acc.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [accounts, showArchived, selectedType, searchQuery]);

  // High-level statistics across active accounts for overview cards
  const stats = useMemo(() => {
    let totalAssets = 0;
    let totalCreditDebt = 0;
    let totalCreditLimit = 0;
    let activeCount = 0;

    for (const acc of accounts) {
      if (acc.isArchived) continue;
      activeCount++;
      const bal = Number(acc.currentBalance) || 0;
      if (acc.type === AccountType.credit_card) {
        totalCreditDebt += bal;
        if (acc.creditLimit) {
          totalCreditLimit += Number(acc.creditLimit) || 0;
        }
      } else {
        totalAssets += bal;
      }
    }

    const netWorth = totalAssets - totalCreditDebt;
    return { totalAssets, totalCreditDebt, totalCreditLimit, netWorth, activeCount };
  }, [accounts]);

  const handleToggleArchive = (id: string, currentArchived: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleArchiveAccountAction(id, !currentArchived);
      if (!res.success) setError(res.error);
    });
  };

  const handleDelete = (id: string, name: string, txCount: number) => {
    setError(null);
    if (txCount > 0) {
      setError(`Cannot delete "${name}" because it contains ${txCount} transaction(s). Please archive it instead.`);
      return;
    }

    if (confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
      startTransition(async () => {
        const res = await deleteAccountAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  const handleOpenEdit = (acc: AccountItem) => {
    setEditingAccount({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      openingBalance: Number(acc.openingBalance) || 0,
      creditLimit: acc.creditLimit ? Number(acc.creditLimit) : null,
      color: acc.color,
      icon: acc.icon,
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.bank:
        return <Building className="h-5 w-5" />;
      case AccountType.credit_card:
        return <CreditCard className="h-5 w-5" />;
      case AccountType.investment:
        return <TrendingUp className="h-5 w-5" />;
      case AccountType.wallet:
        return <Wallet className="h-5 w-5" />;
      case AccountType.cash:
        return <Coins className="h-5 w-5" />;
      default:
        return <Landmark className="h-5 w-5" />;
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

        <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Add Account</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Action Failed</p>
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

      {/* Overview Stat Cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Net Liquid Worth</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              {formatCurrency(stats.netWorth, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Assets minus credit balances</p>
          </Card>

          <Card className="p-4 border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Liquid Assets</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              {formatCurrency(stats.totalAssets, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Across bank, cash & wallet</p>
          </Card>

          <Card className="p-4 border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Credit Debt</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              {formatCurrency(stats.totalCreditDebt, currency)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {stats.totalCreditLimit > 0
                ? `${formatCurrency(stats.totalCreditLimit, currency)} total limit`
                : 'Outstanding credit balances'}
            </p>
          </Card>

          <Card className="p-4 border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Accounts</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              {stats.activeCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {accounts.length - stats.activeCount > 0
                ? `${accounts.length - stats.activeCount} archived account(s)`
                : 'All accounts active'}
            </p>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search accounts by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Account Types</option>
            <option value={AccountType.bank}>Bank Accounts</option>
            <option value={AccountType.cash}>Cash</option>
            <option value={AccountType.credit_card}>Credit Cards</option>
            <option value={AccountType.wallet}>Digital Wallets</option>
            <option value={AccountType.investment}>Investments</option>
            <option value={AccountType.other}>Other Liabilities/Assets</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl px-3 h-9">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Show Archived</span>
          </label>
        </div>
      </div>

      {/* Accounts List / Grid */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No accounts created yet"
          description="Create your first bank account, cash wallet, or credit card to begin tracking your finances with precision."
          actionLabel="Add Your First Account"
          onAction={handleOpenCreate}
        />
      ) : filteredAccounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Landmark className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No matching accounts</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No accounts match your current search query or type filter. Try adjusting your filters.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedType('ALL');
                setShowArchived(true);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map((acc) => {
            const isCard = acc.type === AccountType.credit_card;
            const balanceNum = Number(acc.currentBalance) || 0;
            const txCount = acc._count?.transactions ?? 0;

            return (
              <Card
                key={acc.id}
                className={`relative flex flex-col justify-between overflow-hidden transition-all duration-200 border-slate-200/90 hover:shadow-md ${
                  acc.isArchived ? 'opacity-65 bg-slate-50/80 border-dashed' : 'hover:border-slate-300'
                }`}
              >
                {/* Colored Top Accent Bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: acc.color || '#2563eb' }}
                />

                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm shrink-0"
                      style={{ backgroundColor: acc.color || '#2563eb' }}
                    >
                      {getAccountIcon(acc.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold truncate max-w-[170px] text-slate-900">
                          {acc.name}
                        </CardTitle>
                        {acc.isArchived && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] mt-1 uppercase font-mono tracking-wider text-slate-500">
                        {acc.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit account"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
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
                      onClick={() => handleDelete(acc.id, acc.name, txCount)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={txCount > 0 ? `Cannot delete: contains ${txCount} transaction(s)` : 'Delete account'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">
                      {isCard ? 'Current Balance (Debt)' : 'Current Balance'}
                    </span>
                    <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
                      {formatCurrency(balanceNum, acc.currency || currency)}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Opening Balance:</span>
                      <span className="font-mono font-medium text-slate-700">
                        {formatCurrency(Number(acc.openingBalance) || 0, acc.currency || currency)}
                      </span>
                    </div>

                    {isCard && acc.creditLimit && (
                      <div className="flex items-center justify-between">
                        <span>Credit Limit:</span>
                        <span className="font-mono font-medium text-slate-700">
                          {formatCurrency(Number(acc.creditLimit), acc.currency || currency)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span>Activity:</span>
                      <span className="font-mono text-slate-600">
                        {txCount} {txCount === 1 ? 'transaction' : 'transactions'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={`/accounts/${acc.id}`}
                      className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors border border-slate-200"
                    >
                      <span>View Account & Ledger</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Account Modal (Create or Edit) */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccount(null);
        }}
        currency={currency}
        account={editingAccount}
      />
    </div>
  );
}
