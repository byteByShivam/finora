'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PieChart,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Repeat,
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { BudgetModal, BudgetFormData } from '@/components/budgets/budget-modal';
import { deleteBudgetAction } from '@/app/actions/budget.actions';
import { BudgetWithProgress, BudgetSummaryStats } from '@/server/services/budget.service';
import { formatCurrency } from '@/lib/money';
import { BudgetPeriod } from '@prisma/client';

interface BudgetsViewProps {
  budgets: BudgetWithProgress[];
  summary: BudgetSummaryStats;
  categories: { id: string; name: string }[];
  currency: string;
  activePeriod: BudgetPeriod;
  selectedDateStr: string;
}

export function BudgetsView({
  budgets,
  summary,
  categories,
  currency,
  activePeriod,
  selectedDateStr,
}: BudgetsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exceeded' | 'approaching' | 'healthy'>('all');

  const currentDate = new Date(selectedDateStr);

  const handleNavigatePeriod = (deltaMonths: number) => {
    const nextDate = new Date(currentDate);
    if (activePeriod === BudgetPeriod.yearly) {
      nextDate.setFullYear(nextDate.getFullYear() + deltaMonths);
    } else {
      nextDate.setMonth(nextDate.getMonth() + deltaMonths);
    }
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    router.push(`/budgets?period=${activePeriod}&date=${y}-${m}-01`);
  };

  const handlePeriodTypeChange = (newPeriod: BudgetPeriod) => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    router.push(`/budgets?period=${newPeriod}&date=${y}-${m}-01`);
  };

  const handleEdit = (b: BudgetWithProgress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBudget({
      id: b.id,
      categoryId: b.categoryId,
      amount: b.amount,
      period: b.period,
      rolloverEnabled: b.rolloverEnabled,
      alertThresholdPct: b.alertThresholdPct,
      periodStart: b.periodStart,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    if (confirm(`Are you sure you want to delete the budget for "${name}"? Existing transaction history will NOT be affected.`)) {
      startTransition(async () => {
        const res = await deleteBudgetAction(id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.refresh();
        }
      });
    }
  };

  // Filtered budgets
  const filteredBudgets = budgets.filter((b) => {
    const matchesSearch = b.categoryName.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (statusFilter === 'exceeded') return b.status === 'exceeded';
    if (statusFilter === 'approaching') return b.status === 'approaching' || b.status === 'critical';
    if (statusFilter === 'healthy') return b.status === 'healthy';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'exceeded':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1 text-[11px] font-semibold">
            <AlertCircle className="h-3 w-3" />
            Exceeded
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 text-[11px] font-semibold">
            <AlertTriangle className="h-3 w-3" />
            Critical Limit
          </Badge>
        );
      case 'approaching':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-[11px] font-semibold">
            <Clock className="h-3 w-3" />
            Approaching
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-[11px] font-semibold">
            <ShieldCheck className="h-3 w-3" />
            Healthy
          </Badge>
        );
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'exceeded':
        return 'bg-rose-600';
      case 'critical':
        return 'bg-orange-500';
      case 'approaching':
        return 'bg-amber-500';
      default:
        return 'bg-emerald-600';
    }
  };

  const formattedPeriodLabel = activePeriod === BudgetPeriod.yearly
    ? currentDate.toLocaleDateString('en-US', { year: 'numeric' })
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Budget Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enforce category spending caps and monitor live ledger adherence
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => {
              setEditingBudget(null);
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Create Budget</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Period Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handlePeriodTypeChange(BudgetPeriod.monthly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activePeriod === BudgetPeriod.monthly
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handlePeriodTypeChange(BudgetPeriod.yearly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activePeriod === BudgetPeriod.yearly
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Yearly
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigatePeriod(-1)}
            className="h-8 w-8 rounded-lg border-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-800 min-w-[130px] text-center">
            {formattedPeriodLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigatePeriod(1)}
            className="h-8 w-8 rounded-lg border-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, '0');
              router.push(`/budgets?period=${activePeriod}&date=${y}-${m}-01`);
            }}
            className="text-xs text-emerald-700 hover:text-emerald-800"
          >
            Current
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Budgeted</span>
            <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(summary.totalBudgeted, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {summary.budgetCount} category caps
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Spent</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-700">
            {formatCurrency(summary.totalSpent, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.overallPercentage}% of total limit
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Net Remaining</span>
            <div
              className={`p-1.5 rounded-lg ${
                summary.totalRemaining >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-2 text-2xl font-bold font-mono ${
              summary.totalRemaining >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.totalRemaining, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.totalRemaining >= 0 ? 'Unallocated capacity' : 'Over combined limits'}
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Adherence Status</span>
            <div
              className={`p-1.5 rounded-lg ${
                summary.exceededCount > 0
                  ? 'bg-rose-50 text-rose-600'
                  : summary.warningCount > 0
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {summary.exceededCount}
            </span>
            <span className="text-xs text-rose-600 font-medium">exceeded</span>
            <span className="text-slate-300">|</span>
            <span className="text-2xl font-bold font-mono text-slate-900">
              {summary.warningCount}
            </span>
            <span className="text-xs text-amber-600 font-medium">warning</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.healthyCount} on-track budgets
          </p>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-slate-200 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'exceeded', 'approaching', 'healthy'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap ${
                statusFilter === filter
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {filter === 'all' ? 'All Budgets' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Budgets Grid */}
      {filteredBudgets.length === 0 ? (
        budgets.length === 0 ? (
          <EmptyState
            icon={PieChart}
            title="No budgets configured for this period"
            description="Establish spending limits for frequent expense categories to track live progress and get threshold alerts."
            actionLabel="Create Budget"
            onAction={() => {
              setEditingBudget(null);
              setIsModalOpen(true);
            }}
          />
        ) : (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">No matching budgets</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or status filter.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-3 text-xs"
            >
              Reset filters
            </Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBudgets.map((b) => (
            <Card
              key={b.id}
              onClick={() => router.push(`/budgets/${b.id}`)}
              className="cursor-pointer hover:border-slate-300 transition-all hover:shadow-md flex flex-col justify-between"
            >
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: b.categoryColor || '#3b82f6' }}
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold truncate hover:text-emerald-700 transition-colors">
                      {b.categoryName}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(b.status)}
                      {b.rolloverEnabled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <Repeat className="h-2.5 w-2.5" />
                          Rollover
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => handleEdit(b, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Edit budget"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(b.id, b.categoryName, e)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete budget"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Spent vs Budget</span>
                    <span
                      className={`font-mono font-bold ${
                        b.status === 'exceeded'
                          ? 'text-rose-700'
                          : b.status === 'critical'
                          ? 'text-orange-700'
                          : b.status === 'approaching'
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {b.percentage}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressBarColor(b.status)}`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <p className="text-[10px] uppercase font-sans text-slate-400">Spent</p>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {formatCurrency(b.spent, currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-sans text-slate-400">
                      {b.remaining >= 0 ? 'Remaining' : 'Over By'}
                    </p>
                    <p
                      className={`font-semibold mt-0.5 ${
                        b.remaining < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(Math.abs(b.remaining), currency)}
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50">
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    {b.transactionCount} transactions
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium hover:underline">
                    View Ledger <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Budget Modal (Create or Edit) */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBudget(null);
        }}
        categories={categories}
        currency={currency}
        initialData={editingBudget}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
