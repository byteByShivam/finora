'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MonthlyBarChart, CategoryBreakdownChart } from '@/components/charts/dashboard-charts';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, BarChart3 } from 'lucide-react';

interface AnalyticsViewProps {
  data: {
    year: number;
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    monthlySeries: { month: string; income: number; expense: number; net: number }[];
    categories: { name: string; color: string; amount: number; percentage: number }[];
    accountDistribution: { name: string; balance: number; color: string }[];
  };
  currency: string;
}

export function AnalyticsView({ data, currency }: AnalyticsViewProps) {
  const { totalIncome, totalExpense, netSavings, monthlySeries, categories, accountDistribution } = data;
  const formattedCategories = categories;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Analytics ({data.year})</h1>
        <p className="text-xs text-slate-500 mt-1">
          Annual cashflow trends, spending distribution, and category insights
        </p>
      </div>

      {/* Annual Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Annual Income
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-800">
              +{currency} {totalIncome.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Annual Expenses
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-rose-800">
              -{currency} {totalExpense.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Net Annual Savings
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <PiggyBank className="h-4 w-4" />
              </div>
            </div>
            <p
              className={`mt-2 text-2xl font-bold font-mono ${
                netSavings >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {currency} {netSavings.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Cashflow Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>12-Month Cashflow Trajectory</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Comparison of income credits vs. expense debits</p>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart data={monthlySeries} currency={currency} />
        </CardContent>
      </Card>

      {/* Categories & Account Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Annual Spending by Category</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Where funds flowed across categories</p>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart data={formattedCategories} currency={currency} />
          </CardContent>
        </Card>

        {/* Account Balances Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Distribution</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Balance concentration across liquid accounts</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {accountDistribution.map((acc) => (
              <div key={acc.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{acc.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {currency} {acc.balance.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: acc.color,
                      width: `${Math.min(Math.max((acc.balance / (totalIncome || 1)) * 50, 5), 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
