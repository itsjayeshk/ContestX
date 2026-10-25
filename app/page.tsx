import { BellRing, CalendarRange, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { ContestsProvider } from "@/components/providers/contests-provider";
import { LandingHero } from "@/components/hero/landing-hero";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { FreshnessBar } from "@/components/contests/freshness-bar";
import { buttonVariants } from "@/components/ui/button-variants";
import { loadContests, loadFreshness } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const POINTS = [
  {
    icon: RefreshCcw,
    title: "Schedules collect themselves",
    body: "A background worker checks LeetCode, Codeforces and CodeChef every 20 minutes, picks up new rounds, and notices when a start time moves.",
  },
  {
    icon: BellRing,
    title: "Reminders schedule themselves",
    body: "Choose when you want to hear about contests once: 24 hours, 1 hour, 30, 15 or 5 minutes before. Every new contest gets those reminders by email, push or in-app.",
  },
  {
    icon: CalendarRange,
    title: "Your calendar stays in sync",
    body: "Subscribe your Google, Apple or Outlook calendar to a private feed of the contests you follow, with alarms at your reminder times.",
  },
];

export default async function Home() {
  const { user, timezone } = await getViewer();
  const [contests, freshness] = await Promise.all([loadContests(user, { pastDays: 1 }), loadFreshness()]);

  return (
    <ContestsProvider initialContests={contests} initialFreshness={freshness} timezone={timezone} signedIn={!!user}>
      <LandingHero />

      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="heading text-2xl">Coming up</h2>
            <FreshnessBar />
          </div>
          <UpcomingList limit={8} actions={!!user} />
        </div>
        <aside className="flex flex-col gap-8 lg:pt-14">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-1 size-5 shrink-0 text-violet-soft" aria-hidden />
              <div>
                <h3 className="text-[15px] font-medium text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-fog">{body}</p>
              </div>
            </div>
          ))}
          {!user && (
            <div className="flex flex-col gap-3 border-t border-line pt-6">
              <p className="text-sm text-ink-2">Browsing works without an account. Reminders, saved contests and the calendar feed need one.</p>
              <Link href="/register" className={buttonVariants({ variant: "primary", className: "self-start" })}>
                Create a free account
              </Link>
            </div>
          )}
        </aside>
      </section>
    </ContestsProvider>
  );
}
