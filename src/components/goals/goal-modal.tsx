'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createGoalAction } from '@/app/actions/goal.actions';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string }[];
  currency?: string;
}

export function GoalModal({ isOpen, onClose, accounts, currency = 'INR' }: GoalModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [color, setColor] = useState('#10b981');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseFloat(targetAmount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid target amount.');
      return;
    }

    startTransition(async () => {
      const res = await createGoalAction({
        name,
        targetAmount: num,
        targetDate: targetDate ? new Date(targetDate) : null,
        accountId: accountId || null,
        icon: 'Target',
        color,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setName('');
        setTargetAmount('');
        setTargetDate('');
        onClose();
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Financial Goal" description="Define savings milestones and target dates">
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Goal Name</label>
          <Input
            required
            placeholder="e.g. Emergency Fund, New Laptop, Europe Trip..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Target Amount ({currency})</label>
          <Input
            type="number"
            step="1"
            required
            placeholder="e.g. 100000"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Target Date (Optional)</label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Linked Account (Optional)</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
          >
            <option value="">No linked account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Goal Color Accent</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 rounded-lg cursor-pointer border border-slate-300 bg-white"
            />
            <span className="text-slate-500 font-mono text-xs">{color}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            Create Goal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
