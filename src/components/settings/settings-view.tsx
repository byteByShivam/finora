'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProfileAction, changePasswordAction, deleteAccountAction } from '@/app/actions/settings.actions';

interface SettingsViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    currency: string;
    timezone: string;
  };
}

export function SettingsView({ user }: SettingsViewProps) {
  const router = useRouter();
  const [profilePending, startProfileTransition] = useTransition();
  const [pwPending, startPwTransition] = useTransition();
  const [delPending, startDelTransition] = useTransition();

  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency);
  const [timezone, setTimezone] = useState(user.timezone);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwFeedback, setPwFeedback] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);

    startProfileTransition(async () => {
      const res = await updateProfileAction({ name, currency, timezone });
      if (res.success) {
        setProfileFeedback('Profile details successfully updated.');
      }
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwFeedback(null);
    setPwError(null);

    startPwTransition(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword });
      if (!res.success) {
        setPwError(res.error || 'Failed to update password.');
      } else {
        setPwFeedback('Password updated. All other active sessions have been revoked.');
        setCurrentPassword('');
        setNewPassword('');
      }
    });
  };

  const handleDeleteAccount = () => {
    if (confirm('CRITICAL: Are you sure you want to permanently delete your account and all financial ledger data? This cannot be undone.')) {
      startDelTransition(async () => {
        await deleteAccountAction();
        router.push('/');
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your personal profile, credentials, base currency, and security
        </p>
      </div>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-600" />
            <CardTitle>Profile Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {profileFeedback && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{profileFeedback}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                <Input disabled value={user.email} className="bg-slate-50 text-slate-500 text-sm" />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Email address cannot be changed.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Base Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
                >
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">User Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC +5:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" isLoading={profilePending}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Security Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            <CardTitle>Security & Password</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {pwFeedback && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{pwFeedback}</span>
            </div>
          )}

          {pwError && (
            <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              {pwError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Current Password</label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">New Password</label>
                <Input
                  type="password"
                  required
                  placeholder="Min 8 chars, uppercase, number"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" isLoading={pwPending}>
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-rose-200 bg-rose-50/10">
        <CardHeader>
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle className="text-rose-900">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Permanently Delete Account</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deletes your user profile, transactions, budgets, goals, and all historical data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              isLoading={delPending}
              className="shrink-0"
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
