"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useContests } from "@/components/providers/contests-provider";
import { useNow } from "@/hooks/use-now";
import { platformName } from "@/lib/platforms";
import { relativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PlatformDot } from "./platform-mark";

/** Shows when each platform's schedule was last fetched, and flags stale or failing providers. */
export function FreshnessBar({ className }: { className?: string }) {
  const { freshness, refreshing, refresh, error } = useContests();
  const now = useNow();
  const stale = freshness.filter((f) => f.stale);
  const neverSynced = freshness.every((f) => !f.lastSuccessAt && !f.lastAttemptAt);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fog">
        {freshness.map((f) => (
          <span key={f.platform} className="inline-flex items-center gap-2" title={f.lastError ?? undefined}>
            <PlatformDot platform={f.platform} />
            <span className="text-ink-2">{platformName(f.platform)}</span>
            <span className={cn("num", f.stale && "text-amber")}>
              {f.lastSuccessAt ? `updated ${now ? relativeAgo(f.lastSuccessAt, now) : ""}` : f.lastStatus === "FAILED" ? "unreachable" : "not fetched yet"}
            </span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-fog transition-colors hover:text-ink"
          aria-label="Reload contest list"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Reloading" : "Reload"}
        </button>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {neverSynced ? (
        <p className="flex items-start gap-2 text-[13px] text-amber">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          No contest data has been fetched yet. Start the background worker with <code className="rounded bg-white/5 px-1">npm run worker</code> to collect schedules.
        </p>
      ) : (
        stale.length > 0 && (
          <p className="flex items-start gap-2 text-[13px] text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {stale.map((s) => platformName(s.platform)).join(" and ")} {stale.length > 1 ? "schedules are" : "schedule is"} out of date
            {stale[0].lastError ? ` (last error: ${stale[0].lastError})` : ""}. Showing the last successful data.
          </p>
        )
      )}
    </div>
  );
}
