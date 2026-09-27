import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-4 border border-slate-100 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">{description}</p>
      {actionLabel && (onAction || actionHref) && (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <Button onClick={onAction} variant="default" size="sm">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
