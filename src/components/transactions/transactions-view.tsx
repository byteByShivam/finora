'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit2,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
  AlertCircle,
  Landmark,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionModal, EditableTransaction } from '@/components/transactions/transaction-modal';
import { deleteTransactionAction } from '@/app/actions/transaction.actions';
import { formatDateTime } from '@/lib/dates';
import { formatCurrency, DecimalValue } from '@/lib/money';
import { TxnType } from '@prisma/client';

export interface TransactionRow {
  id: string;
  userId: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  type: TxnType;
  amount: DecimalValue;
  currency: string;
  description: string | null;
  notes: string | null;
  occurredAt: Date | string;
  isReconciled: boolean;
  account: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
  transferAccount: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    type: string;
  } | null;
}

interface TransactionsViewProps {
  initialData: {
    transactions: TransactionRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    summary?: {
      totalIncome: DecimalValue;
      totalExpense: DecimalValue;
      netCashFlow: DecimalValue;
    };
  };
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string; type: string; color?: string | null }[];
  currency: string;
}

export function TransactionsView({
  initialData,
  accounts,
  categories,
  currency,
}: TransactionsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditableTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedAccount, setSelectedAccount] = useState(searchParams.get('account') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'newest');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (selectedAccount) params.set('account', selectedAccount);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedType) params.set('type', selectedType);
    if (sortBy && sortBy !== 'newest') params.set('sortBy', sortBy);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('page', '1');
    router.push(`/transactions?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedAccount('');
    setSelectedCategory('');
    setSelectedType('');
    setSortBy('newest');
    setStartDate('');
    setEndDate('');
    router.push('/transactions');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/transactions?${params.toString()}`);
  };

  const handleDelete = (id: string, desc: string | null) => {
    setError(null);
    if (
      confirm(
        `Are you sure you want to delete this transaction (${desc || 'Untitled'})? Affected account balance(s) will be automatically recalculated.`
      )
    ) {
      startTransition(async () => {
        const res = await deleteTransactionAction(id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.refresh();
        }
      });
    }
  };

  const handleOpenEdit = (t: TransactionRow) => {
    setEditingTransaction({
      id: t.id,
      type: t.type,
      accountId: t.accountId,
      transferAccountId: t.transferAccountId,
      categoryId: t.categoryId,
      amount: Number(t.amount) || 0,
      currency: t.currency,
      description: t.description,
      notes: t.notes,
      occurredAt: t.occurredAt,
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  // Aggregated summary numbers from server
  const summaryIncome = Number(initialData.summary?.totalIncome || 0);
  const summaryExpense = Number(initialData.summary?.totalExpense || 0);
  const summaryNet = Number(initialData.summary?.netCashFlow || 0);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete auditable ledger of income, expenses, and account transfers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/export/csv"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </a>

          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New Transaction</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Error</p>
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

      {/* KPI Overview Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Income Total</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold font-mono tracking-tight text-emerald-600 mt-2">
            +{formatCurrency(summaryIncome, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total revenue in filtered view</p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Expense Total</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold font-mono tracking-tight text-rose-600 mt-2">
            -{formatCurrency(summaryExpense, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total spending in filtered view</p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Net Flow</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`text-xl font-bold font-mono tracking-tight mt-2 ${
              summaryNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {summaryNet >= 0 ? '+' : ''}
            {formatCurrency(summaryNet, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Income minus expenses</p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Ledger Entries</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {initialData.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Matching transactions found</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search description, notes, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Account Filter */}
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              <option value={TxnType.income}>Income (+)</option>
              <option value={TxnType.expense}>Expense (-)</option>
              <option value={TxnType.transfer}>Transfer (↔)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
            {/* Sort By */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest_amount">Highest Amount</option>
                <option value="lowest_amount">Lowest Amount</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="default" onClick={applyFilters} className="h-9 px-4 text-xs gap-1.5 flex-1 sm:flex-none">
                <Filter className="h-3.5 w-3.5" />
                <span>Apply Filters</span>
              </Button>
              <Button size="sm" variant="outline" onClick={clearFilters} className="h-9 text-xs text-slate-600">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table / List */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {initialData.transactions.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Receipt}
                title="No transactions found"
                description={
                  search || selectedAccount || selectedCategory || selectedType || startDate || endDate
                    ? 'No transactions matched your current filter criteria.'
                    : 'Get started by creating your first income, expense, or transfer transaction.'
                }
                actionLabel="Record Transaction"
                onAction={handleOpenCreate}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Account Flow</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialData.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono">
                        {formatDateTime(t.occurredAt)}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {t.description || (t.type === 'transfer' ? 'Account Transfer' : 'Untitled Transaction')}
                        </div>
                        {t.notes && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {t.notes}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.type === 'transfer' ? (
                          <span className="text-slate-400 italic font-mono text-[11px]">Transfer</span>
                        ) : t.category ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: t.category.color || '#3b82f6' }}
                            />
                            <span className="text-slate-800 font-medium">{t.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Uncategorized</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.type === 'transfer' ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <span>{t.account.name}</span>
                            <ArrowLeftRight className="h-3 w-3 text-sky-500" />
                            <span>{t.transferAccount?.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-800 font-medium">{t.account.name}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.type === TxnType.income ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                            Income
                          </Badge>
                        ) : t.type === TxnType.expense ? (
                          <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 border-rose-200">
                            Expense
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-sky-700 bg-sky-50 border-sky-200">
                            Transfer
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-sm">
                        <span
                          className={
                            t.type === TxnType.income
                              ? 'text-emerald-700'
                              : t.type === TxnType.expense
                              ? 'text-rose-700'
                              : 'text-sky-700'
                          }
                        >
                          {t.type === TxnType.income ? '+' : t.type === TxnType.expense ? '-' : '↔ '}
                          {formatCurrency(Number(t.amount) || 0, t.currency || currency)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit transaction"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id, t.description)}
                            disabled={isPending}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {initialData.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 p-4 text-xs text-slate-500 gap-3">
              <span>
                Showing {(initialData.page - 1) * initialData.pageSize + 1} to{' '}
                {Math.min(initialData.page * initialData.pageSize, initialData.total)} of {initialData.total}{' '}
                transactions
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={initialData.page <= 1}
                  onClick={() => handlePageChange(initialData.page - 1)}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-slate-800">
                  Page {initialData.page} of {initialData.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={initialData.page >= initialData.totalPages}
                  onClick={() => handlePageChange(initialData.page + 1)}
                  className="h-8 px-2.5"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Modal (Create & Edit) */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        accounts={accounts}
        categories={categories}
        transaction={editingTransaction}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
