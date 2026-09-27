'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Clock,
  Search,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { RecurringModal } from '@/components/recurring/recurring-modal';
import {
  toggleActiveRecurringAction,
  deleteRecurringAction,
  runCatchUpAction,
} from '@/app/actions/recurring.actions';
import {
  RecurringScheduleItem,
  UpcomingRecurringItem,
  RecurringSummaryStats,
} from '@/server/services/recurring.service';
import { formatCurrency } from '@/lib/money';
import { TxnType } from '@prisma/client';

interface RecurringViewProps {
  recurringList: RecurringScheduleItem[];
  upcomingItems: UpcomingRecurringItem[];
  summaryStats: RecurringSummaryStats;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string }[];
  currency: string;
}

export function RecurringView({
  recurringList,
  upcomingItems,
  summaryStats,
  accounts,
  categories,
  currency,
}: RecurringViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringScheduleItem | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'paused' | 'all' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpcoming, setShowUpcoming] = useState(true);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (id: string, currentActive: boolean) => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const res = await toggleActiveRecurringAction(id, !currentActive);
      if (!res.success) {
        setError(res.error);
      } else {
        setFeedback(currentActive ? 'Schedule paused.' : 'Schedule resumed.');
      }
    });
  };

  const handleDelete = (id: string, desc: string | null) => {
    setError(null);
    setFeedback(null);
    if (confirm(`Delete recurring schedule "${desc || 'Schedule'}"? Note: Generated historical transactions will remain intact in your ledger.`)) {
      startTransition(async () => {
        const res = await deleteRecurringAction(id);
        if (!res.success) {
          setError(res.error);
        } else {
          setFeedback('Recurring schedule removed.');
        }
      });
    }
  };

  const handleCatchUp = () => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const res = await runCatchUpAction();
      if (!res.success) {
        setError(res.error);
      } else {
        setFeedback(
          res.data.generatedCount > 0
            ? `Catch-up executed: generated ${res.data.generatedCount} transaction(s).`
            : 'All scheduled transactions are up to date. Zero pending occurrences.'
        );
      }
    });
  };

  // Filtered schedules list
  const filteredList = useMemo(() => {
    return recurringList.filter((item) => {
      // Tab filter
      if (activeTab === 'active' && item.status !== 'active') return false;
      if (activeTab === 'paused' && item.status !== 'paused') return false;
      if (activeTab === 'completed' && item.status !== 'completed') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const accName = item.account.name.toLowerCase();
        const catName = (item.category?.name || '').toLowerCase();
        const xferName = (item.transferAccount?.name || '').toLowerCase();
        return (
          desc.includes(q) ||
          accName.includes(q) ||
          catName.includes(q) ||
          xferName.includes(q)
        );
      }

      return true;
    });
  }, [recurringList, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recurring Transactions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate recurring expenses, rent, salaries, and account transfers with deterministic catch-up generation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" onClick={handleCatchUp} isLoading={isPending} className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span>Process Catch-Up</span>
          </Button>

          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>New Schedule</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Schedules</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summaryStats.activeCount}
            </span>
            <span className="text-[11px] text-slate-400">of {summaryStats.totalCount} total</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Paused Schedules</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Pause className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summaryStats.pausedCount}
            </span>
            <span className="text-[11px] text-slate-400">inactive</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Projected Outflows</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-rose-700 font-mono">
              {formatCurrency(summaryStats.projectedMonthlyExpenses, currency)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">estimated / month</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Projected Inflows</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-emerald-700 font-mono">
              {formatCurrency(summaryStats.projectedMonthlyIncome, currency)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">estimated / month</span>
          </div>
        </Card>
      </div>

      {/* Upcoming Next 30 Days Section */}
      {upcomingItems.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-sm font-semibold text-slate-900">
                Upcoming Occurrences ({upcomingItems.length})
              </CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setShowUpcoming(!showUpcoming)}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              {showUpcoming ? 'Hide' : 'Show'}
            </button>
          </CardHeader>

          {showUpcoming && (
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcomingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {item.description || (item.type === 'transfer' ? 'Transfer' : 'Recurring Item')}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.type === 'transfer'
                            ? `${item.accountName} → ${item.transferAccountName || 'Account'}`
                            : item.categoryName || item.accountName}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          item.daysUntil === 0
                            ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
                            : 'bg-white text-slate-600'
                        }`}
                      >
                        {item.daysUntil === 0
                          ? 'Due Today'
                          : item.daysUntil === 1
                          ? 'Tomorrow'
                          : `In ${item.daysUntil}d`}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-200/60 pt-2 font-mono">
                      <span className="text-[11px] text-slate-400 font-sans">{item.nextRunAtFormatted}</span>
                      <span
                        className={`font-bold ${
                          item.type === 'income'
                            ? 'text-emerald-700'
                            : item.type === 'expense'
                            ? 'text-rose-700'
                            : 'text-sky-700'
                        }`}
                      >
                        {item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '↔ '}
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({summaryStats.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paused')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'paused'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paused ({summaryStats.pausedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({summaryStats.totalCount})
          </button>
          {summaryStats.completedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                activeTab === 'completed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({summaryStats.completedCount})
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs w-full"
          />
        </div>
      </div>

      {/* Main Recurring List */}
      {filteredList.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={searchQuery ? 'No matching schedules' : 'No recurring schedules'}
          description={
            searchQuery
              ? 'Try modifying your search term or filter selection.'
              : 'Create recurring templates for salary deposits, subscriptions, or savings transfers.'
          }
          actionLabel="Create Schedule"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((r) => {
            const isIncome = r.type === TxnType.income;
            const isTransfer = r.type === TxnType.transfer;

            return (
              <Card
                key={r.id}
                className={`transition-all ${
                  !r.isActive || r.status === 'completed'
                    ? 'opacity-70 bg-slate-50/50'
                    : 'hover:border-slate-300 shadow-sm'
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 text-emerald-600'
                          : isTransfer
                          ? 'bg-sky-50 text-sky-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isTransfer ? (
                        <ArrowLeftRight className="h-5 w-5" />
                      ) : (
                        <Repeat className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate font-semibold">
                        {r.description || (isTransfer ? 'Scheduled Transfer' : 'Scheduled Item')}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge
                          variant={r.status === 'active' ? 'success' : 'secondary'}
                          className="text-[10px] capitalize font-mono"
                        >
                          {r.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize font-mono">
                          {r.interval > 1 ? `Every ${r.interval} ${r.frequency}` : r.frequency}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditItem(r)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Edit schedule"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {r.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleToggle(r.id, r.isActive)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={r.isActive ? 'Pause schedule' : 'Resume schedule'}
                      >
                        {r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.description)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  <div>
                    <p className="text-[10px] uppercase font-sans text-slate-400">Scheduled Amount</p>
                    <p
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        isIncome
                          ? 'text-emerald-800'
                          : isTransfer
                          ? 'text-sky-800'
                          : 'text-rose-800'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '↔ ' : '-'}
                      {formatCurrency(r.amount, currency)}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-1.5 text-xs text-slate-600">
                    {isTransfer ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Transfer:</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1 truncate max-w-[190px]">
                          <span className="truncate">{r.account.name}</span>
                          <ArrowLeftRight className="h-3 w-3 text-sky-500 shrink-0" />
                          <span className="truncate">{r.transferAccount?.name || 'Account'}</span>
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Account:</span>
                          <span className="font-medium text-slate-800 truncate max-w-[190px]">
                            {r.account.name}
                          </span>
                        </div>
                        {r.category && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Category:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[190px]">
                              {r.category.name}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Next Occurrence:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {r.nextRunAtFormatted}
                      </span>
                    </div>

                    {r.endDateFormatted && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">End Date:</span>
                        <span className="text-slate-600 font-mono">{r.endDateFormatted}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
                      <span>Generated transactions:</span>
                      <span className="font-bold text-slate-600 font-mono">
                        {r.generatedTransactionsCount}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      <RecurringModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        accounts={accounts}
        categories={categories}
        currency={currency}
      />

      {/* Edit Modal */}
      <RecurringModal
        isOpen={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        accounts={accounts}
        categories={categories}
        currency={currency}
        initialData={editItem}
      />
    </div>
  );
}
