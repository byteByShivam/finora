import { requireUser } from '@/server/auth/session';
import { SettingsView } from '@/components/settings/settings-view';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <SettingsView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
      }}
    />
  );
}
