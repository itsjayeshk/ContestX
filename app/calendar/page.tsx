import type { Metadata } from "next";
import { ContestsProvider } from "@/components/providers/contests-provider";
import { ContestCalendar } from "@/components/calendar/contest-calendar";
import { FreshnessBar } from "@/components/contests/freshness-bar";
import { PageHeader } from "@/components/layout/page-header";
import { loadContests, loadFreshness } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { user, timezone } = await getViewer();
  const [contests, freshness] = await Promise.all([loadContests(user, { pastDays: 120 }), loadFreshness()]);
  return (
    <ContestsProvider initialContests={contests} initialFreshness={freshness} timezone={timezone} signedIn={!!user}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PageHeader title="Calendar">Every contest on the day it runs. Select one for details, reminders and calendar export.</PageHeader>
        <ContestCalendar />
        <FreshnessBar />
      </div>
    </ContestsProvider>
  );
}
