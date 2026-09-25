'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import { registerAction } from '@/app/actions/auth.actions';

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const passedCriteriaCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  let strengthLabel = 'Too Weak';
  let strengthColor = 'bg-rose-500';
  let strengthWidth = 'w-1/5';

  if (passedCriteriaCount === 5) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500';
    strengthWidth = 'w-full';
  } else if (passedCriteriaCount >= 3) {
    strengthLabel = 'Moderate';
    strengthColor = 'bg-amber-500';
    strengthWidth = 'w-3/5';
  } else if (passedCriteriaCount >= 1) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-rose-400';
    strengthWidth = 'w-2/5';
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (passedCriteriaCount < 5) {
      setError('Password does not meet all security requirements.');
      return;
    }

    startTransition(async () => {
      const res = await registerAction({
        name,
        email,
        password,
        confirmPassword,
        currency,
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
      });

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
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:bg-emerald-700 transition-colors">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">Finora</span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-500">
              Sign in
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              placeholder="Alex Rivera"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              placeholder="alex@example.com"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="Min. 8 characters"
                className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {password.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Security strength:</span>
                  <span className="font-semibold text-slate-700">{strengthLabel}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${strengthColor} ${strengthWidth} transition-all duration-300`}></div>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-slate-500">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : ''}`}>
                    {hasMinLength ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-700 font-medium' : ''}`}>
                    {hasUppercase ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                    <span>Uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-700 font-medium' : ''}`}>
                    {hasLowercase ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                    <span>Lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : ''}`}>
                    {hasNumber ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-medium' : ''}`}>
                    {hasSpecial ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                    <span>Special symbol</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-slate-700">
              Confirm Password
            </label>
            <div className="relative mt-1">
              <input
                id="reg-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                placeholder="Re-enter your password"
                className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-rose-600">Passwords do not match.</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-currency" className="block text-sm font-medium text-slate-700">
              Base Currency
            </label>
            <select
              id="reg-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isPending}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 bg-white"
            >
              <option value="INR">INR — Indian Rupee (₹)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
