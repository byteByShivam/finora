'use client';

import { useState, useTransition } from 'react';
import {
  PieChart,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { BudgetModal } from '@/components/budgets/budget-modal';
import { deleteBudgetAction } from '@/app/actions/budget.actions';
import { BudgetWithProgress } from '@/server/services/budget.service';

interface BudgetsViewProps {
  budgets: BudgetWithProgress[];
  categories: { id: string; name: string }[];
  currency: string;
}

export function BudgetsView({ budgets, categories, currency }: BudgetsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = (id: string, name: string) => {
    setError(null);
    if (confirm(`Are you sure you want to delete the budget for "${name}"?`)) {
      startTransition(async () => {
        const res = await deleteBudgetAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  const totalBudgeted = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const overallPercentage = totalBudgeted > 0 ? Math.min(Math.round((totalSpent / totalBudgeted) * 100), 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Category Budgets</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor and enforce spending caps with real-time transaction ledger tracking
          </p>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Set Budget</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Budget Health Bar */}
      {budgets.length > 0 && (
        <Card className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Monthly Budget Adherence
                </span>
                <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                  {currency} {totalSpent.toLocaleString()} / {currency} {totalBudgeted.toLocaleString()}
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-300 text-emerald-900 bg-white font-mono self-start sm:self-auto">
                {overallPercentage}% Utilized
              </Badge>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  totalSpent > totalBudgeted ? 'bg-rose-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Cards Grid */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budgets configured"
          description="Create spending caps for your frequent expense categories to prevent overspending."
          actionLabel="Create Budget"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map((b) => (
            <Card
              key={b.id}
              className={`hover:border-slate-300 transition-colors ${
                b.isOverBudget ? 'border-rose-300 bg-rose-50/20' : b.isWarning ? 'border-amber-300 bg-amber-50/20' : ''
              }`}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.categoryColor || '#3b82f6' }}
                  />
                  <div>
                    <CardTitle className="text-base">{b.categoryName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] capitalize font-mono">
                        {b.period}
                      </Badge>
                      {b.rolloverEnabled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Repeat className="h-2.5 w-2.5" />
                          Rollover
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(b.id, b.categoryName)}
                  disabled={isPending}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete budget"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Spent vs Budget</span>
                    <span
                      className={`font-mono font-bold ${
                        b.isOverBudget ? 'text-rose-700' : b.isWarning ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {b.percentage}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        b.isOverBudget ? 'bg-rose-500' : b.isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <p className="text-[10px] uppercase font-sans text-slate-400">Spent</p>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {currency} {b.spent.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-sans text-slate-400">
                      {b.remaining >= 0 ? 'Remaining' : 'Over By'}
                    </p>
                    <p
                      className={`font-semibold mt-0.5 ${
                        b.remaining < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {currency} {Math.abs(b.remaining).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Budget Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        currency={currency}
      />
    </div>
  );
}
