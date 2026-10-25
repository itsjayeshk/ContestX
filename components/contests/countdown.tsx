"use client";
import { useNow } from "@/hooks/use-now";
import { contestPhase, countdown, formatCountdownShort } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ContestDTO } from "@/types/contest";

/** Compact text countdown, e.g. "in 2d 4h", "ends in 41m". */
export function CountdownText({ contest, className }: { contest: ContestDTO; className?: string }) {
  const now = useNow();
  if (!now) return <span className={cn("num text-fog", className)}>&nbsp;</span>;
  if (contest.cancelled) return <span className={cn("text-fog", className)}>Not happening</span>;
  const phase = contestPhase(contest.startTime, contest.endTime, now);
  if (phase === "ended") return <span className={cn("text-fog-2", className)}>Finished</span>;
  if (phase === "ongoing") return <span className={cn("num text-cyan", className)}>ends {formatCountdownShort(contest.endTime, now)}</span>;
  return <span className={cn("num text-ink", className)}>{formatCountdownShort(contest.startTime, now)}</span>;
}

/** Large segmented countdown: days, hours, minutes, seconds. */
export function CountdownClock({ target, className, size = "lg" }: { target: string; className?: string; size?: "md" | "lg" }) {
  const now = useNow();
  const c = now ? countdown(target, now) : null;
  const units: [string, number | null][] = [
    ["days", c?.days ?? null],
    ["hours", c?.hours ?? null],
    ["minutes", c?.minutes ?? null],
    ["seconds", c?.seconds ?? null],
  ];
  return (
    <div className={cn("flex items-end gap-3 sm:gap-5", className)} role="timer" aria-live="off" aria-label={c ? `${c.days} days ${c.hours} hours ${c.minutes} minutes` : "Loading countdown"}>
      {units.map(([label, v], i) => (
        <div key={label} className="flex items-end gap-3 sm:gap-5">
          <div className="flex flex-col">
            <span
              className={cn(
                "num display tabular-nums text-ink",
                size === "lg" ? "text-[44px] sm:text-[64px]" : "text-[32px] sm:text-[40px]",
                label === "seconds" && "text-fog",
              )}
            >
              {v === null ? "--" : String(v).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-xs text-fog">{label}</span>
          </div>
          {i < units.length - 1 && <span className={cn("pb-7 text-fog-2", size === "lg" ? "text-3xl" : "text-2xl")}>:</span>}
        </div>
      ))}
    </div>
  );
}
