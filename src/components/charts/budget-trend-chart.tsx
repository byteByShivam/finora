'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/money';

interface BudgetTrendChartProps {
  data: Array<{ date: string; amount: number; cumulative: number }>;
  budgetLimit: number;
  currency: string;
}

export function BudgetTrendChart({ data, budgetLimit, currency }: BudgetTrendChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.cumulative === 0)) {
    return (
      <div className="flex h-56 flex-col items-center justify-center text-xs text-slate-400 gap-1">
        <span>No expense activity recorded during this budget period.</span>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="budgetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              formatCurrency(Number(value || 0), currency),
              name === 'cumulative' ? 'Cumulative Spend' : 'Daily Spend',
            ]}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
              fontSize: '12px',
            }}
          />
          {budgetLimit > 0 && (
            <ReferenceLine
              y={budgetLimit}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{
                value: `Limit (${formatCurrency(budgetLimit, currency)})`,
                fill: '#ef4444',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#budgetGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
