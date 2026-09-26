'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/money';

interface GoalProgressChartProps {
  data: Array<{
    date: string;
    amount: number;
    cumulative: number;
  }>;
  targetAmount: number;
  currency?: string;
  color?: string;
}

export function GoalProgressChart({
  data,
  targetAmount,
  currency = 'INR',
  color = '#10b981',
}: GoalProgressChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-slate-400 text-xs">
        <p>No contributions recorded yet to generate savings trajectory.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.cumulative), targetAmount);
  const yDomainMax = Math.ceil(maxVal * 1.1);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="goalProgressGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            domain={[0, yDomainMax]}
            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
            dx={-5}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as { date: string; amount: number; cumulative: number };
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-700">{item.date}</p>
                    <div className="flex justify-between gap-4 text-slate-500">
                      <span>Deposit:</span>
                      <span className="font-mono font-medium text-slate-900">
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-emerald-600 font-semibold border-t border-slate-100 pt-1">
                      <span>Total Saved:</span>
                      <span className="font-mono">
                        {formatCurrency(item.cumulative, currency)}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Target Amount Reference Line */}
          <ReferenceLine
            y={targetAmount}
            stroke="#64748b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Target: ${formatCurrency(targetAmount, currency)}`,
              position: 'insideTopRight',
              fill: '#64748b',
              fontSize: 11,
              fontWeight: 500,
            }}
          />

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#goalProgressGradient)"
            activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
