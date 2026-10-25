import type { Metadata } from "next";
import { ContestsProvider } from "@/components/providers/contests-provider";
import { NextContest } from "@/components/dashboard/next-contest";
import { StatsOverview, type StreakSummary } from "@/components/dashboard/stats-overview";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { Greeting, LocalClock } from "@/components/dashboard/local-clock";
import { NextReminders, type NextReminderItem } from "@/components/dashboard/next-reminders";
import { FreshnessBar } from "@/components/contests/freshness-bar";
import { prisma } from "@/lib/db";
import { loadParticipation } from "@/lib/participation";
import { loadContests, loadFreshness } from "@/lib/queries";
import { computeStreaks } from "@/lib/streaks";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, timezone } = await getViewer();
  const [contests, freshness, pending, profile] = await Promise.all([
    loadContests(user, { pastDays: 1 }),
    loadFreshness(),
    user ? prisma.scheduledReminder.count({ where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } } }) : Promise.resolve(null),
    user ? prisma.user.findUnique({ where: { id: user.id }, select: { codeforcesHandle: true, leetcodeHandle: true } }) : Promise.resolve(null),
  ]);

  const upcomingReminders = user
    ? await prisma.scheduledReminder.findMany({
        where: { userId: user.id, status: "PENDING", fireAt: { gte: new Date() } },
        orderBy: { fireAt: "asc" },
        take: 15,
        include: { contest: { select: { name: true, platform: true } } },
      })
    : [];
  // Collapse channels of the same reminder time into one row.
  const nextReminders: NextReminderItem[] = [];
  for (const r of upcomingReminders) {
    const prev = nextReminders.find((n) => n.fireAt === r.fireAt.toISOString() && n.contestName === r.contest.name);
    if (prev) prev.channels.push(r.channel);
    else nextReminders.push({ id: r.id, fireAt: r.fireAt.toISOString(), offsetMinutes: r.offsetMinutes, channels: [r.channel], contestName: r.contest.name, platform: r.contest.platform });
  }

  let streak: StreakSummary | null = null;
  if (profile) {
    const linked = !!(profile.codeforcesHandle || profile.leetcodeHandle);
    if (linked) {
      const data = await loadParticipation({ codeforces: profile.codeforcesHandle, leetcode: profile.leetcodeHandle });
      const failed = data.sources.filter((s) => !s.ok);
      const s = computeStreaks(data.participations.map((p) => p.date));
      streak = { ...s, linked, error: failed.length === data.sources.length ? failed[0]?.error : undefined };
    } else {
      streak = { current: 0, longest: 0, linked: false };
    }
  }

  return (
    <ContestsProvider initialContests={contests} initialFreshness={freshness} timezone={timezone} signedIn={!!user}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="display text-[clamp(2rem,4.6vw,3.25rem)]">
              <Greeting timezone={timezone} />
            </h1>
            <p className="mt-3 text-ink-2">Your next opportunity to climb the leaderboard is approaching.</p>
          </div>
          <LocalClock timezone={timezone} />
        </header>

        <StatsOverview remindersPending={pending} streak={streak} />

        <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <NextContest />
            <NextReminders items={nextReminders.slice(0, 5)} timezone={timezone} signedIn={!!user} />
          </div>
          <section className="panel flex min-w-0 flex-col gap-4 p-6" aria-labelledby="after-that">
            <h2 id="after-that" className="heading text-lg">
              After that
            </h2>
            <UpcomingList limit={6} skipFirst actions={!!user} />
          </section>
        </div>

        <FreshnessBar />
      </div>
    </ContestsProvider>
  );
}
