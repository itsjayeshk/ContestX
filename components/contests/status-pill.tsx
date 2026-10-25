"use client";
import { useNow } from "@/hooks/use-now";
import { contestPhase } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ContestDTO } from "@/types/contest";

export function StatusPill({ contest, className }: { contest: ContestDTO; className?: string }) {
  const now = useNow();
  if (contest.cancelled) {
    return <span className={cn("inline-flex h-6 items-center rounded-full border border-danger/30 bg-danger/10 px-2.5 text-xs text-danger", className)}>Cancelled</span>;
  }
  const phase = contestPhase(contest.startTime, contest.endTime, now ?? new Date(contest.lastFetchedAt));
  const styles = {
    upcoming: "border-line-strong text-ink-2",
    ongoing: "border-cyan/40 bg-cyan/10 text-cyan",
    ended: "border-line text-fog-2",
  }[phase];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs", styles, className)}>
      {phase === "ongoing" && <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-60" /><span className="relative inline-flex size-1.5 rounded-full bg-cyan" /></span>}
      {phase === "upcoming" ? "Upcoming" : phase === "ongoing" ? "Live now" : "Ended"}
    </span>
  );
}
