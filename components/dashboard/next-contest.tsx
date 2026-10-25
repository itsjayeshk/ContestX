"use client";
import { ArrowUpRight, CalendarClock, Timer } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { CountdownClock } from "@/components/contests/countdown";
import { CalendarMenu, ReminderControl, BookmarkButton } from "@/components/contests/contest-actions";
import { PlatformMark } from "@/components/contests/platform-mark";
import { SampleBadge, ScheduleChange } from "@/components/contests/contest-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { EmptyState } from "@/components/ui/empty";
import { useNow } from "@/hooks/use-now";
import { pickFeatured } from "@/lib/filter-contests";
import { platformName } from "@/lib/platforms";
import { contestPhase, formatDayLong, formatDuration, formatTime, zoneLabel } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ContestDTO } from "@/types/contest";

const WEEK = 7 * 86_400_000;

/** Ring fills as the contest approaches over the final week; while live it shows elapsed time. */
function ProgressRing({ contest, now }: { contest: ContestDTO; now: Date | null }) {
  const size = 132;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let fraction = 0;
  let caption = "";
  if (now) {
    const start = new Date(contest.startTime).getTime();
    const end = new Date(contest.endTime).getTime();
    const t = now.getTime();
    if (t >= start) {
      fraction = Math.min(1, (t - start) / (end - start));
      caption = "elapsed";
    } else {
      fraction = Math.max(0, Math.min(1, 1 - (start - t) / WEEK));
      caption = "of the final week";
    }
  }
  return (
    <div className="relative grid size-[132px] shrink-0 place-items-center" aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b7bff" />
            <stop offset="1" stopColor="#7fe3f0" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / .07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="display num text-2xl">{now ? Math.round(fraction * 100) : "--"}%</span>
        <span className="mt-0.5 max-w-20 text-center text-[10px] leading-tight text-fog">{caption}</span>
      </div>
    </div>
  );
}

export function NextContest() {
  const { contests, timezone } = useContests();
  const now = useNow();
  const ref = now ?? new Date(contests[0]?.lastFetchedAt ?? 0);
  const minute = Math.floor(ref.getTime() / 60_000);

  // Prefer a contest that is live right now; otherwise the next one to start.
  const featured = useMemo(() => pickFeatured(contests, ref), [contests, minute]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!featured) {
    return (
      <EmptyState title="No upcoming contest yet" icon={<CalendarClock />} className="h-full">
        As soon as a platform announces a round it appears here with a countdown.
      </EmptyState>
    );
  }

  const live = contestPhase(featured.startTime, featured.endTime, ref) === "ongoing";
  return (
    <article className="panel ring-gradient relative flex flex-col gap-6 overflow-hidden p-6 sm:p-7" aria-label={`Next contest: ${featured.name}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(28rem_18rem_at_100%_0%,rgb(139_123_255/.16),transparent_70%)]" />
      <div className="relative flex flex-wrap items-center gap-3">
        <PlatformMark platform={featured.platform} size="lg" />
        <div>
          <p className="text-[13px] text-fog">{live ? "Live now" : "Next contest"} on {platformName(featured.platform)}</p>
          <h2 className="heading text-2xl text-ink sm:text-[28px]">{featured.name}</h2>
        </div>
        {featured.isSample && <SampleBadge />}
      </div>

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-fog">{live ? "Ends in" : "Starts in"}</p>
          <CountdownClock target={live ? featured.endTime : featured.startTime} size="md" />
        </div>
        <ProgressRing contest={featured} now={now} />
      </div>

      <dl className="relative grid grid-cols-2 gap-4 border-t border-line pt-5 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-fog">Date</dt>
          <dd className="text-ink-2">{formatDayLong(featured.startTime, timezone).replace(/, \d{4}$/, "")}</dd>
        </div>
        <div>
          <dt className="text-fog">Start</dt>
          <dd className="num text-ink-2">
            {formatTime(featured.startTime, timezone)} {zoneLabel(timezone, new Date(featured.startTime))}
          </dd>
        </div>
        <div>
          <dt className="text-fog">Duration</dt>
          <dd className="num inline-flex items-center gap-1 text-ink-2">
            <Timer className="size-3.5 text-fog" aria-hidden />
            {formatDuration(featured.durationSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-fog">Format</dt>
          <dd className="text-ink-2">{[featured.division, featured.kind].filter(Boolean).join(", ") || "Not listed"}</dd>
        </div>
      </dl>
      <ScheduleChange contest={featured} />

      <div className="relative mt-auto flex flex-wrap items-center gap-2">
        <a href={featured.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "primary" })}>
          {live ? "Open contest" : "Register on platform"} <ArrowUpRight />
        </a>
        <CalendarMenu contest={featured} />
        <ReminderControl contest={featured} />
        <BookmarkButton contest={featured} />
        <Link href="/contests" className={cn(buttonVariants({ variant: "link" }), "ml-auto text-[13px]")}>
          All contests
        </Link>
      </div>
    </article>
  );
}
