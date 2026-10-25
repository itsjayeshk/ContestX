"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { PlatformMark } from "@/components/contests/platform-mark";
import { CountdownText } from "@/components/contests/countdown";
import { BookmarkButton, ReminderControl } from "@/components/contests/contest-actions";
import { SampleBadge } from "@/components/contests/contest-card";
import { useNow } from "@/hooks/use-now";
import { pickFeatured } from "@/lib/filter-contests";
import { dayKey, formatDuration, formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";

function dayHeading(key: string, todayKey: string, tomorrowKey: string, tz: string, sample: string) {
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "short" }).format(new Date(sample));
}

/** Upcoming contests grouped by local day. */
export function UpcomingList({ limit = 8, skipFirst = false, actions = true, className }: { limit?: number; skipFirst?: boolean; actions?: boolean; className?: string }) {
  const { contests, timezone } = useContests();
  const now = useNow();
  const ref = now ?? new Date(contests[0]?.lastFetchedAt ?? 0);
  const minute = Math.floor(ref.getTime() / 60_000);

  const groups = useMemo(() => {
    const upcoming = contests
      .filter((c) => !c.cancelled && new Date(c.endTime).getTime() > ref.getTime())
      .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
    const featured = skipFirst ? pickFeatured(contests, ref) : null;
    const list = upcoming.filter((c) => c.id !== featured?.id).slice(0, limit);
    const map = new Map<string, typeof list>();
    for (const c of list) {
      const k = dayKey(c.startTime, timezone);
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.entries()];
  }, [contests, minute, timezone, limit, skipFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = dayKey(ref, timezone);
  const tomorrowKey = dayKey(new Date(ref.getTime() + 86_400_000), timezone);

  if (groups.length === 0) {
    return <p className={cn("text-sm text-fog", className)}>Nothing else is scheduled yet. New contests show up here as platforms announce them.</p>;
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {groups.map(([key, items]) => (
        <section key={key} aria-label={dayHeading(key, todayKey, tomorrowKey, timezone, items[0].startTime)}>
          <h3 className="mb-2 text-[13px] text-fog">{dayHeading(key, todayKey, tomorrowKey, timezone, items[0].startTime)}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className="num w-12 shrink-0 text-[13px] text-ink-2">{formatTime(c.startTime, timezone)}</span>
                <PlatformMark platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[14px] text-ink hover:text-violet-soft">
                    {c.name}
                  </a>
                  <p className="text-xs text-fog">
                    {formatDuration(c.durationSeconds)}
                    {c.scheduleChangedAt && <span className="text-amber">, time changed</span>}
                  </p>
                </div>
                {c.isSample && <SampleBadge className="hidden sm:inline-flex" />}
                <CountdownText contest={c} className="hidden text-[13px] sm:inline" />
                {actions && (
                  <div className="flex items-center">
                    <ReminderControl contest={c} compact />
                    <BookmarkButton contest={c} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/contests" className="self-start text-[13px] text-violet-soft hover:text-ink">
        See the full schedule
      </Link>
    </div>
  );
}
