'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  Repeat,
  Receipt,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BudgetModal, BudgetFormData } from '@/components/budgets/budget-modal';
import { BudgetTrendChart } from '@/components/charts/budget-trend-chart';
import { deleteBudgetAction } from '@/app/actions/budget.actions';
import { BudgetDetailResult } from '@/server/services/budget.service';
import { formatCurrency } from '@/lib/money';
import { formatDateTime } from '@/lib/dates';

interface BudgetDetailViewProps {
  detail: BudgetDetailResult;
  currency: string;
  categories: { id: string; name: string }[];
}

export function BudgetDetailView({ detail, currency, categories }: BudgetDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { budget, transactions, spendingTrend } = detail;

  const handleEdit = () => {
    setEditingBudget({
      id: budget.id,
      categoryId: budget.categoryId,
      amount: budget.amount,
      period: budget.period,
      rolloverEnabled: budget.rolloverEnabled,
      alertThresholdPct: budget.alertThresholdPct,
      periodStart: budget.periodStart,
    });
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the budget for "${budget.categoryName}"? Existing transaction history will NOT be affected.`)) {
      startTransition(async () => {
        const res = await deleteBudgetAction(budget.id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.push('/budgets');
        }
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'exceeded':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1 text-xs font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Budget Exceeded
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Critical Limit
          </Badge>
        );
      case 'approaching':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Approaching Limit
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
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

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/budgets" className="hover:text-slate-800 flex items-center gap-1 font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Budgets</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{budget.categoryName}</span>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm shrink-0"
            style={{ backgroundColor: budget.categoryColor || '#3b82f6' }}
          >
            <span className="text-lg font-bold">
              {budget.categoryName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{budget.categoryName} Budget</h1>
              {getStatusBadge(budget.status)}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="capitalize font-mono">{budget.period} Cap</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                From {new Date(budget.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {budget.rolloverEnabled && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    <Repeat className="h-3 w-3" />
                    Rollover Enabled
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Budget</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Budget Limit</span>
          <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(budget.effectiveBudget, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {budget.rolloverAmount > 0
              ? `Includes ${formatCurrency(budget.rolloverAmount, currency)} rollover`
              : 'Base allocation cap'}
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Spent to Date</span>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-700">
            {formatCurrency(budget.spent, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {budget.transactionCount} expense records
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">
            {budget.remaining >= 0 ? 'Remaining Budget' : 'Amount Over Budget'}
          </span>
          <p
            className={`mt-2 text-2xl font-bold font-mono ${
              budget.remaining >= 0 ? 'text-emerald-700' : 'text-rose-700 font-extrabold'
            }`}
          >
            {formatCurrency(Math.abs(budget.remaining), currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {budget.remaining >= 0 ? 'Remaining to spend safely' : 'Exceeded allocated limit'}
          </p>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Budget Adherence</span>
            <span
              className={`font-mono font-bold ${
                budget.status === 'exceeded'
                  ? 'text-rose-700'
                  : budget.status === 'critical'
                  ? 'text-orange-700'
                  : budget.status === 'approaching'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {budget.percentage}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all ${getProgressBarColor(budget.status)}`}
              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Warning threshold at {budget.alertThresholdPct}%
          </p>
        </Card>
      </div>

      {/* Spending Trajectory Chart */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            Cumulative Spending Trajectory
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Progressive daily spend plotted against your budget cap
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <BudgetTrendChart
            data={spendingTrend}
            budgetLimit={budget.effectiveBudget}
            currency={currency}
          />
        </CardContent>
      </Card>

      {/* Related Expense Ledger Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Transactions in this Period
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Live ledger entries contributing to this category&apos;s budget total
            </p>
          </div>
          <Link
            href={`/transactions?category=${budget.categoryId}`}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <span>Search transactions</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                No expense transactions recorded in this category for the active period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-medium">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {formatDateTime(tx.occurredAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-[200px] truncate">
                        {tx.description || 'Expense'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: tx.account.color || '#64748b' }}
                          />
                          <span className="text-slate-600 truncate">{tx.account.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                        -{formatCurrency(tx.amount, tx.currency || currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        currency={currency}
        initialData={editingBudget}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
