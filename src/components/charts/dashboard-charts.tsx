'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/money';

export interface IncomeVsExpenseChartItem {
  date?: string;
  month?: string;
  income: number;
  expense: number;
  netCashFlow?: number;
  net?: number;
}

interface IncomeVsExpenseChartProps {
  data: IncomeVsExpenseChartItem[];
  currency?: string;
}

export function IncomeVsExpenseChart({ data, currency = 'INR' }: IncomeVsExpenseChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.income === 0 && d.expense === 0)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-400 gap-1">
        <span>No income or expense activity recorded for this period.</span>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    date: d.date || d.month || '',
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
            formatter={(value: any, name: any) => [
              formatCurrency(Number(value || 0), currency),
              name,
            ]}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CashFlowTrendChartProps {
  data: { date: string; netCashFlow: number }[];
  currency?: string;
}

export function CashFlowTrendChart({ data, currency = 'INR' }: CashFlowTrendChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.netCashFlow === 0)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-400 gap-1">
        <span>No net cash flow movement in this period.</span>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
            tickFormatter={(val) => `${val >= 1000 || val <= -1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
          <Tooltip
            formatter={(value: any) => [
              formatCurrency(Number(value || 0), currency),
              'Net Cash Flow',
            ]}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey="netCashFlow"
            name="Net Cash Flow"
            maxBarSize={32}
            shape={(props: any) => {
              const { fill, x, y, width, height, value } = props;
              const barFill = value >= 0 ? '#10b981' : '#f43f5e';
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={Math.abs(height)}
                  fill={barFill}
                  rx={3}
                  ry={3}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CategoryBreakdownChartProps {
  data: { name: string; amount: number; percentage: number; color: string }[];
  currency?: string;
}

export function CategoryBreakdownChart({ data, currency = 'INR' }: CategoryBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-400 gap-1">
        <span>No expense categories recorded for this period.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 h-72">
      <div className="h-56 w-56 relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="amount"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [formatCurrency(Number(value || 0), currency), 'Spent']}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 w-full space-y-2.5 overflow-y-auto max-h-56 pr-2">
        {data.slice(0, 6).map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color || '#3b82f6' }}
              />
              <span className="font-medium text-slate-700 truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-slate-900 font-mono">
                {formatCurrency(item.amount, currency)}
              </span>
              <span className="text-slate-400 text-[11px] font-mono w-10 text-right">
                ({item.percentage.toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MonthlyBarChart = IncomeVsExpenseChart;
