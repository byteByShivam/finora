import Link from 'next/link';
import {
  ShieldCheck,
  TrendingUp,
  PieChart,
  ArrowRight,
  Wallet,
  Sparkles,
} from 'lucide-react';

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Finora</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-semibold text-emerald-800 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Production-Grade Ledger & Analytics</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
                Clarity and confidence for your personal wealth.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Finora provides an auditable, decimal-safe double-entry ledger with automated budget rollover, milestone-driven savings goals, and real-time financial analytics.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all"
                >
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                >
                  Demo Login
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-slate-100 bg-slate-50/50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Architecture & Integrity</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Built to institutional fintech standards
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Zero Floating-Point Error</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Every account balance, transfer, and budget remaining figure is calculated in PostgreSQL and Prisma Decimal with strict decimal arithmetic.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-6">
                  <PieChart className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Budget Rollover Engine</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Category-level spending caps with proactive alert thresholds (80%, 90%, 100%) and optional unspent budget carryover into next month.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-6">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Target-Date Goals</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Track emergency funds, investments, and milestone targets with contribution ledgers linked directly to real transactions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Finora Personal Finance Management System.</p>
          <div className="flex items-center gap-6">
            <span>Next.js 15 App Router</span>
            <span>PostgreSQL & Prisma</span>
            <span>Decimal Arithmetic</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
