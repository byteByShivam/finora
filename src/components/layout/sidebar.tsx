'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  PieChart,
  Target,
  BarChart3,
  Repeat,
  FileText,
  Tags,
  Bell,
  Settings,
  LogOut,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/app/actions/auth.actions';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/budgets', label: 'Budgets', icon: PieChart },
  { href: '/goals', label: 'Financial Goals', icon: Target },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  user: {
    name: string;
    email: string;
    currency: string;
  };
  unreadCount?: number;
}

export function Sidebar({ user, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white min-h-screen">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">Finora</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Financial Ledger</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isNotif = item.href === '/notifications';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span>{item.label}</span>
              </div>
              {isNotif && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile & Logout */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {user.currency}
          </span>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition-colors shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
