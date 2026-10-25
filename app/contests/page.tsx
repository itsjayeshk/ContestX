import type { Metadata } from "next";
import { ContestsProvider } from "@/components/providers/contests-provider";
import { ContestExplorer } from "@/components/contests/contest-explorer";
import { FreshnessBar } from "@/components/contests/freshness-bar";
import { PageHeader } from "@/components/layout/page-header";
import { TimezonePicker } from "@/components/settings/timezone-picker";
import { loadContests, loadFreshness } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "All contests" };
export const dynamic = "force-dynamic";

export default async function ContestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const { user, timezone } = await getViewer();
  const [contests, freshness] = await Promise.all([loadContests(user, { pastDays: 60 }), loadFreshness()]);
  return (
    <ContestsProvider initialContests={contests} initialFreshness={freshness} timezone={timezone} signedIn={!!user}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
        <PageHeader title="All contests" aside={<TimezonePicker value={timezone} compact />}>
          LeetCode, Codeforces and CodeChef in one list. Times are shown in your timezone.
        </PageHeader>
        <FreshnessBar />
        <ContestExplorer initialParams={params} />
      </div>
    </ContestsProvider>
  );
}
