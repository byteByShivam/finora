'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryModal } from '@/components/categories/category-modal';
import { deleteCategoryAction } from '@/app/actions/category.actions';
import { CategoryType } from '@prisma/client';

interface CategoryItem {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  userId: string | null;
}

interface CategoriesViewProps {
  categories: CategoryItem[];
}

export function CategoriesView({ categories }: CategoriesViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomeCategories = categories.filter((c) => c.type === CategoryType.income);
  const expenseCategories = categories.filter((c) => c.type === CategoryType.expense);

  const handleDelete = (id: string, name: string) => {
    setError(null);
    if (confirm(`Delete custom category "${name}"? Only categories with no transaction history can be deleted.`)) {
      startTransition(async () => {
        const res = await deleteCategoryAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories Taxonomy</h1>
          <p className="text-xs text-slate-500 mt-1">
            Standard fintech classifications and custom user-defined categories
          </p>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          <span>New Category</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Expense Categories & Income Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Expense Categories</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {expenseCategories.length} Categories
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {expenseCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#f97316' }}
                  />
                  <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {c.isSystem ? (
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      System
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono text-emerald-700">
                        Custom
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={isPending}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Income Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Income Categories</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {incomeCategories.length} Categories
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {incomeCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#10b981' }}
                  />
                  <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {c.isSystem ? (
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      System
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono text-emerald-700">
                        Custom
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={isPending}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <CategoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
