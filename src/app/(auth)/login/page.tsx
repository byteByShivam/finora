'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loginAction } from '@/app/actions/auth.actions';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (!res.success) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    });
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError(null);

    startTransition(async () => {
      const res = await loginAction({ email: demoEmail, password: 'Password123!' });
      if (!res.success) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">Finora</span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Or{' '}
            <Link href="/register" className="font-medium text-emerald-600 hover:text-emerald-500">
              create a new account
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              placeholder="alex@finora.test"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              placeholder="••••••••••••"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast Login */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
            Instant Demo Profiles
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin('alex@finora.test')}
              disabled={isPending}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <div>
                <span className="font-semibold text-slate-900">Alex Rivera</span>
                <span className="text-slate-500 block">Salaried Professional (alex@finora.test)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('sarah@finora.test')}
              disabled={isPending}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <div>
                <span className="font-semibold text-slate-900">Sarah Chen</span>
                <span className="text-slate-500 block">Consultant & Freelancer (sarah@finora.test)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
