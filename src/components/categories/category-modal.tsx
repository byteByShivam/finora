'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCategoryAction } from '@/app/actions/category.actions';
import { CategoryType } from '@prisma/client';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(CategoryType.expense);
  const [color, setColor] = useState('#10b981');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createCategoryAction({
        name,
        type,
        color,
        icon: 'Tag',
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setName('');
        onClose();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Custom Category"
      description="Define a new income or expense category"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Category Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType(CategoryType.expense)}
              className={`py-2 text-xs font-semibold rounded-xl border text-center transition-colors ${
                type === CategoryType.expense
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              Expense Category
            </button>
            <button
              type="button"
              onClick={() => setType(CategoryType.income)}
              className={`py-2 text-xs font-semibold rounded-xl border text-center transition-colors ${
                type === CategoryType.income
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              Income Category
            </button>
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Category Name</label>
          <Input
            required
            placeholder="e.g. Fitness & Sports, Gaming, Pet Supplies..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Category Color Accent</label>
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
            Save Category
          </Button>
        </div>
      </form>
    </Modal>
  );
}
