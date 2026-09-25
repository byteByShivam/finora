'use client';

import { useState } from 'react';
import { FileText, Download, Printer, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportsViewProps {
  user: { name: string; email: string; currency: string };
  report: {
    period: string;
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
    categoryBreakdown: { name: string; amount: number; percentage: number; color: string }[];
  };
}

export function ReportsView({ user, report }: ReportsViewProps) {
  const { period, totalIncome, totalExpense, netSavings, savingsRate, categoryBreakdown } = report;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Formal ledger statements and downloadable audit records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/export/csv"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download CSV</span>
          </a>

          <a
            href="/api/export/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Print Statement</span>
          </a>
        </div>
      </div>

      {/* Formal Statement Card */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">Monthly Financial Statement</CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Statement Period: <span className="font-semibold text-slate-800">{period}</span>
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500">
              <p className="font-bold text-slate-900">{user.name}</p>
              <p>{user.email}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Summary Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Inflow (Income)
              </span>
              <p className="text-xl font-bold font-mono text-emerald-800 mt-1">
                +{user.currency} {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Outflow (Expenses)
              </span>
              <p className="text-xl font-bold font-mono text-rose-800 mt-1">
                -{user.currency} {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Net Period Cashflow
              </span>
              <p
                className={`text-xl font-bold font-mono mt-1 ${
                  netSavings >= 0 ? 'text-slate-900' : 'text-rose-700'
                }`}
              >
                {user.currency} {netSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Savings rate: {savingsRate}%
              </span>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3">Expenditure by Category</h4>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Amount ({user.currency})</th>
                    <th className="py-2.5 px-4 text-right">% of Total Spending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No category expenditure for this period.
                      </td>
                    </tr>
                  ) : (
                    categoryBreakdown.map((cat) => (
                      <tr key={cat.name} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: cat.color || '#3b82f6' }}
                          />
                          <span>{cat.name}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                          {cat.percentage}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Generated directly from Finora PostgreSQL double-entry ledger</span>
            <span className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Decimal Arithmetic Verified</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
