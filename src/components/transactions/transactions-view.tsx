'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Trash2,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { QuickTransactionModal } from '@/components/transactions/quick-transaction-modal';
import { deleteTransactionAction } from '@/app/actions/transaction.actions';
import { formatDateTime } from '@/lib/dates';
import { TxnType } from '@prisma/client';

interface TransactionsViewProps {
  initialData: {
    transactions: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string; type: string }[];
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

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedAccount, setSelectedAccount] = useState(searchParams.get('account') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedAccount) params.set('account', selectedAccount);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedType) params.set('type', selectedType);
    params.set('page', '1');
    router.push(`/transactions?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedAccount('');
    setSelectedCategory('');
    setSelectedType('');
    router.push('/transactions');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/transactions?${params.toString()}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction? Account balance will be recalculated.')) {
      startTransition(async () => {
        await deleteTransactionAction(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete auditable history of income, expenses, and account transfers
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

          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            <span>New Transaction</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search description..."
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
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-700"
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
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-700"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-700"
            >
              <option value="">All Types</option>
              <option value={TxnType.income}>Income (+)</option>
              <option value={TxnType.expense}>Expense (-)</option>
              <option value={TxnType.transfer}>Transfer (↔)</option>
            </select>

            {/* Filter Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={applyFilters} className="flex-1 h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
              </Button>
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 text-xs text-slate-500">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table / List */}
      <Card>
        <CardContent className="p-0">
          {initialData.transactions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Receipt}
                title="No transactions found"
                description={
                  search || selectedAccount || selectedCategory || selectedType
                    ? 'No transactions matched your current filter criteria.'
                    : 'Get started by creating your first income, expense, or transfer transaction.'
                }
                actionLabel="Record Transaction"
                onAction={() => setIsModalOpen(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialData.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDateTime(t.occurredAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                        {t.description || (t.type === 'transfer' ? 'Transfer' : 'Transaction')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {t.type === 'transfer' ? (
                          <span className="text-slate-400 italic">Transfer</span>
                        ) : t.category ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: t.category.color || '#3b82f6' }}
                            />
                            <span className="text-slate-700">{t.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {t.type === 'transfer' ? (
                          <span className="text-slate-700">
                            {t.account.name} → {t.transferAccount?.name}
                          </span>
                        ) : (
                          <span className="text-slate-700">{t.account.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            t.type === 'income' ? 'success' : t.type === 'expense' ? 'destructive' : 'secondary'
                          }
                          className="capitalize text-[10px]"
                        >
                          {t.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            t.type === 'income'
                              ? 'text-emerald-700'
                              : t.type === 'expense'
                              ? 'text-rose-700'
                              : 'text-blue-700'
                          }
                        >
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                          {currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          disabled={isPending}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {initialData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs text-slate-500">
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
                  className="h-8 px-2"
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
                  className="h-8 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Transaction Modal */}
      <QuickTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
