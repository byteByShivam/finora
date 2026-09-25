'use client';

import Link from 'next/link';
import { Bell, Plus, Menu } from 'lucide-react';

interface TopbarProps {
  user: {
    name: string;
    email: string;
    currency: string;
  };
  unreadCount?: number;
  onOpenMobileMenu?: () => void;
}

export function Topbar({ user, unreadCount = 0, onOpenMobileMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden -ml-1.5 p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
          Welcome back, <span className="font-semibold text-slate-800">{user.name}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications Icon */}
        <Link
          href="/notifications"
          className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
          )}
        </Link>

        {/* Quick Add Transaction CTA */}
        <Link
          href="/transactions?new=1"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Transaction</span>
        </Link>
      </div>
    </header>
  );
}
