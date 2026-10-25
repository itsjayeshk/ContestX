import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { GuestGate } from "@/components/reminders/guest-gate";
import { ScheduledList } from "@/components/reminders/scheduled-list";
import { PlatformMark } from "@/components/contests/platform-mark";
import { prisma } from "@/lib/db";
import { emailConfigured, pushConfigured } from "@/lib/env";
import { formatDateTime, formatOffset, relativeAgo, zoneLabel } from "@/lib/time";
import { getViewer } from "@/lib/viewer";
import { workerStatus } from "@/lib/worker-status";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Reminders" };
export const dynamic = "force-dynamic";

const CHANNEL = { EMAIL: "Email", PUSH: "Push", IN_APP: "In-app" } as const;

export default async function RemindersPage() {
  const { user, timezone } = await getViewer();
  if (!user) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PageHeader title="Reminders" />
        <GuestGate title="Reminders need an account">
          Reminders are sent by a server-side worker, even when this site isn&apos;t open, so they have to be tied to an account and a delivery address.
          Without one you can still browse every contest and add any of them to your own calendar.
        </GuestGate>
      </div>
    );
  }

  const now = new Date();
  const [pref, pending, history, saved, pushCount, worker] = await Promise.all([
    prisma.reminderPreference.findUnique({ where: { userId: user.id } }),
    prisma.scheduledReminder.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] }, fireAt: { gte: new Date(now.getTime() - 3600_000) } },
      include: { contest: true },
      orderBy: { fireAt: "asc" },
      take: 200,
    }),
    prisma.notificationDelivery.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60, include: { reminder: { select: { offsetMinutes: true } } } }),
    prisma.contestBookmark.findMany({ where: { userId: user.id, contest: { endTime: { gte: now } } }, include: { contest: true }, orderBy: { contest: { startTime: "asc" } } }),
    prisma.pushSubscription.count({ where: { userId: user.id } }),
    workerStatus(),
  ]);

  const channelStates = [
    { name: "In-app", on: !!pref?.inAppEnabled, ok: true, note: "Shows in the bell menu" },
    { name: "Email", on: !!pref?.emailEnabled, ok: emailConfigured(), note: emailConfigured() ? `To ${user.email}` : "Not configured on this server" },
    {
      name: "Push",
      on: !!pref?.pushEnabled,
      ok: pushConfigured() && pushCount > 0,
      note: !pushConfigured() ? "Not configured on this server" : pushCount === 0 ? "No browser subscribed yet" : `${pushCount} browser${pushCount > 1 ? "s" : ""}`,
    },
  ];

  const groups = new Map<string, { contest: (typeof pending)[number]["contest"]; items: typeof pending }>();
  for (const r of pending) {
    const g = groups.get(r.contestId) ?? { contest: r.contest, items: [] };
    g.items.push(r);
    groups.set(r.contestId, g);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6">
      <PageHeader title="Reminders">What the reminder worker is going to send you, and everything it has sent so far.</PageHeader>

      <section aria-labelledby="status" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5">
          <h2 id="status" className="mb-4 text-sm text-fog">Delivery</h2>
          <ul className="flex flex-col gap-3">
            {channelStates.map((c) => (
              <li key={c.name} className="flex items-center gap-3 text-sm">
                {!c.on ? <CircleSlash className="size-4 text-fog-2" /> : c.ok ? <CheckCircle2 className="size-4 text-ok" /> : <AlertTriangle className="size-4 text-amber" />}
                <span className="w-16 text-ink">{c.name}</span>
                <span className={cn("text-fog", c.on && !c.ok && "text-amber")}>{c.on ? c.note : "Off"}</span>
              </li>
            ))}
          </ul>
          <Link href="/settings" className="mt-4 inline-block text-[13px] text-violet-soft hover:text-ink">
            Change channels and default times
          </Link>
        </div>
        <div className="panel p-5">
          <h2 className="mb-4 text-sm text-fog">Reminder worker</h2>
          {worker.alive ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <CheckCircle2 className="size-4 text-ok" /> Running, last checked in {worker.ageSec}s ago
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-amber">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {worker.lastBeat
                ? `The worker hasn't checked in since ${relativeAgo(worker.lastBeat)}. Reminders will wait until it is back; any that come due after a contest starts are skipped and recorded.`
                : "No reminder worker has run yet. Reminders are scheduled but nothing will be sent until it starts (npm run worker)."}
            </p>
          )}
          <p className="mt-3 text-[13px] text-fog">
            Defaults: {pref?.enabled ? (pref.offsetsMinutes.map(formatOffset).join(", ") || "none") + " before each contest" : "reminders are off"}. Delivery depends on your email provider and browser, so check history below if something didn&apos;t arrive.
          </p>
        </div>
      </section>

      <section aria-labelledby="scheduled" className="flex flex-col gap-4">
        <h2 id="scheduled" className="heading text-xl">
          Scheduled <span className="num text-fog">{pending.length}</span>
        </h2>
        <ScheduledList
          timezone={timezone}
          groups={[...groups.values()].map((g) => ({
            contest: { id: g.contest.id, name: g.contest.name, platform: g.contest.platform, startTime: g.contest.startTime.toISOString(), url: g.contest.url, isSample: g.contest.isSample },
            items: g.items.map((r) => ({ id: r.id, fireAt: r.fireAt.toISOString(), channel: r.channel, offsetMinutes: r.offsetMinutes, status: r.status, attempts: r.attempts, lastError: r.lastError })),
          }))}
        />
      </section>

      <section aria-labelledby="saved" className="flex flex-col gap-4">
        <h2 id="saved" className="heading text-xl">
          Saved contests <span className="num text-fog">{saved.length}</span>
        </h2>
        {saved.length === 0 ? (
          <p className="text-sm text-fog">
            Save contests from the <Link href="/contests" className="text-violet-soft hover:text-ink">contest list</Link> to keep them here.
            {pref?.scope === "BOOKMARKED_ONLY" && " Your settings only send reminders for saved contests."}
          </p>
        ) : (
          <ul className="panel divide-y divide-line">
            {saved.map((b) => (
              <li key={b.contestId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <PlatformMark platform={b.contest.platform} size="sm" />
                <a href={b.contest.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-ink hover:text-violet-soft">
                  {b.contest.name}
                </a>
                <span className="num text-fog">{formatDateTime(b.contest.startTime, timezone)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history" className="flex flex-col gap-4">
        <h2 id="history" className="heading text-xl">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-fog">Nothing sent yet. Each delivery attempt, successful or not, is listed here.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-fog">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Notification</th>
                  <th className="px-4 py-3 font-normal">Channel</th>
                  <th className="px-4 py-3 font-normal">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="num whitespace-nowrap px-4 py-3 text-ink-2">
                      {formatDateTime(h.createdAt, timezone)} <span className="text-fog-2">{zoneLabel(timezone, h.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink">{h.title}</span>
                      {h.isTest && <span className="ml-2 text-fog">(test)</span>}
                      {h.reminder && <span className="ml-2 text-fog">{formatOffset(h.reminder.offsetMinutes)} reminder</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{CHANNEL[h.channel]}</td>
                    <td className="px-4 py-3">
                      {h.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1.5 text-ok">
                          <CheckCircle2 className="size-3.5" /> {h.channel === "EMAIL" ? "Accepted by provider" : h.channel === "PUSH" ? "Sent to push service" : "Delivered"}
                        </span>
                      ) : h.status === "SKIPPED" ? (
                        <span className="inline-flex items-center gap-1.5 text-fog" title={h.error ?? ""}>
                          <CircleSlash className="size-3.5" /> Skipped{h.error ? `: ${h.error}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-danger" title={h.error ?? ""}>
                          <XCircle className="size-3.5" /> Failed{h.error ? `: ${h.error.slice(0, 80)}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
