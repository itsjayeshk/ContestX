"use client";
import { ArrowUpRight, History } from "lucide-react";
import { useContests } from "@/components/providers/contests-provider";
import { PlatformMark } from "./platform-mark";
import { StatusPill } from "./status-pill";
import { CountdownText } from "./countdown";
import { BookmarkButton, CalendarMenu, ReminderControl } from "./contest-actions";
import { formatDateTime, formatDuration, zoneLabel } from "@/lib/time";
import { platformName } from "@/lib/platforms";
import { cn } from "@/lib/cn";
import type { ContestDTO } from "@/types/contest";

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap", className)} data-sample>
      <span className="inline-flex h-5 items-center rounded-full border border-amber/40 bg-amber/10 px-2 text-[11px] text-amber" title="Development sample, not live data">
      Sample data
      </span>
    </span>
  );
}

export function ScheduleChange({ contest }: { contest: ContestDTO }) {
  const { timezone } = useContests();
  if (!contest.scheduleChangedAt || !contest.previousStartTime) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-amber">
      <History className="size-3.5" aria-hidden />
      Moved from {formatDateTime(contest.previousStartTime, timezone)}
    </p>
  );
}

/** Grid card. */
export function ContestCard({ contest }: { contest: ContestDTO }) {
  const { timezone } = useContests();
  const meta = [contest.division, contest.kind].filter(Boolean).join(", ");
  return (
    <article className={cn("panel group flex flex-col gap-4 p-5 transition-colors hover:border-line-strong", contest.cancelled && "opacity-60")} aria-label={contest.name}>
      <div className="flex items-start justify-between gap-3">
        <PlatformMark platform={contest.platform} withName />
        <div className="flex items-center gap-2">
          {contest.isSample && <SampleBadge />}
          <StatusPill contest={contest} />
        </div>
      </div>
      <div className="min-h-[3.25rem]">
        <h3 className={cn("heading text-[17px] text-ink", contest.cancelled && "line-through decoration-fog-2")}>{contest.name}</h3>
        {meta && <p className="mt-1 text-[13px] text-fog">{meta}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <div>
          <dt className="text-fog">Starts</dt>
          <dd className="num text-ink-2">
            {formatDateTime(contest.startTime, timezone)} <span className="text-fog-2">{zoneLabel(timezone, new Date(contest.startTime))}</span>
          </dd>
        </div>
        <div>
          <dt className="text-fog">Duration</dt>
          <dd className="num text-ink-2">{formatDuration(contest.durationSeconds)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Countdown</dt>
          <dd className="text-[15px]">
            <CountdownText contest={contest} />
          </dd>
        </div>
      </dl>
      <ScheduleChange contest={contest} />
      <div className="mt-auto flex items-center justify-between gap-1 border-t border-line pt-3">
        <ReminderControl contest={contest} compact />
        <div className="flex items-center gap-0.5">
          <CalendarMenu contest={contest} compact />
          <BookmarkButton contest={contest} />
          <a
            href={contest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] px-3 text-[13px] text-ink-2 hover:bg-white/[0.05] hover:text-ink"
            aria-label={`Open ${contest.name} on ${platformName(contest.platform)}`}
          >
            Open <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/** Dense list row for the chronological view; collapses to a card layout on small screens. */
export function ContestRow({ contest }: { contest: ContestDTO }) {
  const { timezone } = useContests();
  return (
    <li className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-white/[0.02] md:grid-cols-[auto_minmax(0,1fr)_11rem_6rem_8rem_auto]", contest.cancelled && "opacity-60")}>
      <PlatformMark platform={contest.platform} />
      <div className="min-w-0">
        <a href={contest.url} target="_blank" rel="noopener noreferrer" className={cn("line-clamp-2 font-medium text-ink hover:text-violet-soft md:line-clamp-1", contest.cancelled && "line-through")}>
          {contest.name}
        </a>
        <p className="flex items-center gap-2 text-[13px] text-fog">
          <span className="truncate">{[platformName(contest.platform), contest.division, contest.kind].filter(Boolean).join(", ")}</span>
          {contest.isSample && <SampleBadge />}
        </p>
        <ScheduleChange contest={contest} />
      </div>
      <div className="col-span-3 col-start-2 row-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] md:col-span-1 md:col-start-auto md:row-start-auto md:contents">
        <span className="num text-ink-2">{formatDateTime(contest.startTime, timezone)}</span>
        <span className="num text-fog">{formatDuration(contest.durationSeconds)}</span>
        <CountdownText contest={contest} className="text-[13px]" />
      </div>
      <div className="col-start-3 row-start-1 flex items-center justify-end gap-0.5 md:col-start-auto md:row-start-auto">
        <StatusPill contest={contest} className="mr-1 hidden lg:inline-flex" />
        <ReminderControl contest={contest} compact />
        <CalendarMenu contest={contest} compact />
        <BookmarkButton contest={contest} />
      </div>
    </li>
  );
}
