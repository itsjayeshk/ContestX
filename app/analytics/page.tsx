import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-charts";
import { prisma } from "@/lib/db";
import { loadParticipation, type ParticipationData } from "@/lib/participation";
import { getViewer } from "@/lib/viewer";
import { PLATFORMS } from "@/types/contest";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { user, timezone } = await getViewer();
  const now = new Date();
  const profile = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { codeforcesHandle: true, leetcodeHandle: true } }) : null;

  const [grouped, participation] = await Promise.all([
    prisma.contest.groupBy({
      by: ["platform"],
      where: { state: "SCHEDULED", isSample: false },
      _count: true,
    }),
    profile && (profile.codeforcesHandle || profile.leetcodeHandle)
      ? loadParticipation({ codeforces: profile.codeforcesHandle, leetcode: profile.leetcodeHandle })
      : Promise.resolve<ParticipationData | null>(null),
  ]);
  const upcomingByPlatform = await prisma.contest.groupBy({ by: ["platform"], where: { state: "SCHEDULED", isSample: false, startTime: { gt: now } }, _count: true });

  const tracked = PLATFORMS.map((p) => {
    const total = grouped.find((g) => g.platform === p)?._count ?? 0;
    const upcoming = upcomingByPlatform.find((g) => g.platform === p)?._count ?? 0;
    return { platform: p, upcoming, completed: total - upcoming };
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeader title="Analytics">Your contest history from the platforms&apos; public data, and what ContestX is tracking.</PageHeader>
      <AnalyticsDashboard signedIn={!!user} timezone={timezone} participation={participation} tracked={tracked} nowIso={now.toISOString()} />
    </div>
  );
}
