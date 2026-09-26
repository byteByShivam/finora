'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createGoalAction, updateGoalAction } from '@/app/actions/goal.actions';
import {
  Shield,
  Laptop,
  Palmtree,
  Car,
  Home,
  GraduationCap,
  TrendingUp,
  Target,
  Sparkles,
  Plane,
  Heart,
  PiggyBank,
} from 'lucide-react';
import { GoalStatus } from '@prisma/client';

export const GOAL_ICONS = [
  { name: 'Target', icon: Target, label: 'General Target' },
  { name: 'Shield', icon: Shield, label: 'Emergency Fund' },
  { name: 'Laptop', icon: Laptop, label: 'Electronics / Tech' },
  { name: 'Palmtree', icon: Palmtree, label: 'Vacation / Travel' },
  { name: 'Car', icon: Car, label: 'Vehicle' },
  { name: 'Home', icon: Home, label: 'House / Real Estate' },
  { name: 'GraduationCap', icon: GraduationCap, label: 'Education' },
  { name: 'TrendingUp', icon: TrendingUp, label: 'Investment' },
  { name: 'PiggyBank', icon: PiggyBank, label: 'Savings' },
  { name: 'Heart', icon: Heart, label: 'Health / Wellness' },
  { name: 'Plane', icon: Plane, label: 'Flight' },
  { name: 'Sparkles', icon: Sparkles, label: 'Special Occasion' },
];

export const GOAL_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
];

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string }[];
  currency?: string;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    targetAmount: number;
    targetDate?: Date | string | null;
    accountId?: string | null;
    icon?: string | null;
    color?: string | null;
    status?: GoalStatus;
  } | null;
}

export function GoalModal({
  isOpen,
  onClose,
  accounts,
  currency = 'INR',
  initialData,
}: GoalModalProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(initialData?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [icon, setIcon] = useState('Target');
  const [color, setColor] = useState('#10b981');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setTargetAmount(initialData.targetAmount.toString());
      setTargetDate(
        initialData.targetDate
          ? new Date(initialData.targetDate).toISOString().split('T')[0]
          : ''
      );
      setAccountId(initialData.accountId || '');
      setIcon(initialData.icon || 'Target');
      setColor(initialData.color || '#10b981');
    } else {
      setName('');
      setDescription('');
      setTargetAmount('');
      setTargetDate('');
      setAccountId('');
      setIcon('Target');
      setColor('#10b981');
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Goal name is required.');
      return;
    }

    const num = parseFloat(targetAmount);
    if (isNaN(num) || !Number.isFinite(num) || num <= 0) {
      setError('Please enter a valid positive target amount.');
      return;
    }

    startTransition(async () => {
      let res;
      if (isEditing && initialData?.id) {
        res = await updateGoalAction(initialData.id, {
          name: trimmedName,
          description: description.trim() || null,
          targetAmount: num,
          targetDate: targetDate ? new Date(targetDate) : null,
          accountId: accountId || null,
          icon,
          color,
        });
      } else {
        res = await createGoalAction({
          name: trimmedName,
          description: description.trim() || null,
          targetAmount: num,
          targetDate: targetDate ? new Date(targetDate) : null,
          accountId: accountId || null,
          icon,
          color,
        });
      }

      if (!res.success) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Financial Goal' : 'Create Financial Goal'}
      description="Define milestone targets, target dates, and linked savings accounts."
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Goal Name <span className="text-rose-500">*</span>
          </label>
          <Input
            required
            placeholder="e.g. Emergency Fund, New MacBook, Europe Trip..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Description (Optional)</label>
          <textarea
            rows={2}
            placeholder="What is this goal for? (e.g. 6 months of living expenses reserve)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Target Amount ({currency}) <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              step="any"
              min="1"
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
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Linked Savings Account (Optional)
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800"
          >
            <option value="">No linked account (Direct tracking)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            If linked, contributions funded from another account can automatically create transfer transactions.
          </p>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block font-medium text-slate-700 mb-1.5">Goal Icon</label>
          <div className="grid grid-cols-6 gap-2">
            {GOAL_ICONS.map((item) => {
              const IconComp = item.icon;
              const isSelected = icon === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setIcon(item.name)}
                  title={item.label}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block font-medium text-slate-700 mb-1.5">Accent Color</label>
          <div className="flex items-center gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
