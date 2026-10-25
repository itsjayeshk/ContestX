import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GuestGate } from "@/components/reminders/guest-gate";
import { AccountSettings, CalendarFeed, ReminderSettings } from "@/components/settings/settings-forms";
import { TimezonePicker } from "@/components/settings/timezone-picker";
import { prisma } from "@/lib/db";
import { emailConfigured, env, pushConfigured } from "@/lib/env";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, timezone } = await getViewer();
  if (!user) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PageHeader title="Settings" />
        <div className="flex max-w-xl flex-col gap-2">
          <p className="text-sm text-ink">Timezone</p>
          <TimezonePicker value={timezone} />
          <p className="text-[13px] text-fog">Saved in this browser. Contest times everywhere use it.</p>
        </div>
        <GuestGate title="Reminder settings need an account">
          With an account you choose platforms and reminder times once, and every new contest is scheduled for you by email, browser push or in-app, plus a private calendar feed.
        </GuestGate>
      </div>
    );
  }

  const [full, pref, pushCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} }),
    prisma.pushSubscription.count({ where: { userId: user.id } }),
  ]);
  const e = env();

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 py-10 sm:px-6">
      <div className="pb-10">
        <PageHeader title="Settings">Set this up once. New contests pick up these choices automatically.</PageHeader>
      </div>
      <ReminderSettings
        initial={{
          enabled: pref.enabled,
          scope: pref.scope,
          offsetsMinutes: pref.offsetsMinutes,
          platforms: pref.platforms,
          emailEnabled: pref.emailEnabled,
          pushEnabled: pref.pushEnabled,
          inAppEnabled: pref.inAppEnabled,
        }}
        caps={{ emailConfigured: emailConfigured(), pushConfigured: pushConfigured(), vapidPublicKey: e.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null, pushSubscriptions: pushCount, email: full.email }}
      />
      <CalendarFeed initialUrl={`${e.APP_URL.replace(/\/$/, "")}/api/calendar/feed/${full.calendarToken}.ics`} />
      <AccountSettings initial={{ name: full.name, email: full.email, timezone: full.timezone, codeforcesHandle: full.codeforcesHandle, leetcodeHandle: full.leetcodeHandle }} />
    </div>
  );
}
