"use client";
import { BellRing, Bookmark, CalendarDays, Flame } from "lucide-react";
import { useMemo } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { useNow } from "@/hooks/use-now";
import { StatCard } from "./stat-card";

export interface StreakSummary {
  current: number;
  longest: number;
  linked: boolean;
  error?: string;
}

export function StatsOverview({ remindersPending, streak }: { remindersPending: number | null; streak: StreakSummary | null }) {
  const { contests, signedIn } = useContests();
  const now = useNow();
  const ref = now ?? new Date(contests[0]?.lastFetchedAt ?? 0);
  const hour = Math.floor(ref.getTime() / 3_600_000);
  const { upcoming, week, saved } = useMemo(() => {
    const up = contests.filter((c) => !c.cancelled && new Date(c.startTime) > ref);
    return {
      upcoming: up.length,
      week: up.filter((c) => +new Date(c.startTime) - ref.getTime() < 7 * 86_400_000).length,
      saved: up.filter((c) => c.bookmarked).length,
    };
  }, [contests, hour]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Upcoming contests" value={upcoming} icon={<CalendarDays />} hint={`${week} in the next 7 days`} href="/contests" />
      <StatCard
        label="Saved"
        value={signedIn ? saved : null}
        icon={<Bookmark />}
        emptyText={<a href="/login" className="text-violet-soft hover:text-ink">Sign in to save contests</a>}
        hint={signedIn ? "upcoming contests you saved" : undefined}
        href={signedIn ? "/contests?saved=1" : undefined}
      />
      <StatCard
        label="Reminders scheduled"
        value={remindersPending}
        icon={<BellRing />}
        emptyText={<a href="/login" className="text-violet-soft hover:text-ink">Sign in to get reminders</a>}
        hint={remindersPending !== null ? "waiting to be sent" : undefined}
        href={remindersPending !== null ? "/reminders" : undefined}
      />
      <StatCard
        label="Participation streak"
        value={streak && streak.linked && !streak.error ? streak.current : null}
        unit={streak?.current === 1 ? "week" : "weeks"}
        icon={<Flame />}
        emptyText={
          !signedIn ? (
            <a href="/login" className="text-violet-soft hover:text-ink">Sign in to track a streak</a>
          ) : streak?.error ? (
            <span title={streak.error}>Couldn&apos;t reach the platform</span>
          ) : (
            <a href="/settings#account" className="text-violet-soft hover:text-ink">Link a Codeforces or LeetCode handle</a>
          )
        }
        hint={streak?.linked && !streak.error ? `longest ${streak.longest} ${streak.longest === 1 ? "week" : "weeks"}` : undefined}
        href={streak?.linked ? "/analytics" : undefined}
      />
    </div>
  );
}
