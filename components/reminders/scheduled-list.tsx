"use client";
import { BellOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PlatformMark } from "@/components/contests/platform-mark";
import { SampleBadge } from "@/components/contests/contest-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDateTime, formatOffset, zoneLabel } from "@/lib/time";
import type { PlatformId } from "@/types/contest";

interface Group {
  contest: { id: string; name: string; platform: PlatformId; startTime: string; url: string; isSample: boolean };
  items: { id: string; fireAt: string; channel: "EMAIL" | "PUSH" | "IN_APP"; offsetMinutes: number; status: string; attempts: number; lastError: string | null }[];
}

const CH = { EMAIL: "email", PUSH: "push", IN_APP: "in-app" } as const;

export function ScheduledList({ groups, timezone }: { groups: Group[]; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const exclude = async (contestId: string) => {
    setBusy(contestId);
    try {
      await api("/api/contest-preferences", { method: "PUT", json: { contestId, excluded: true } });
      toast.success("Reminders cancelled for this contest");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel reminders");
    } finally {
      setBusy(null);
    }
  };

  if (groups.length === 0) {
    return <p className="text-sm text-fog">No reminders are waiting. New ones are scheduled automatically as contests are announced, based on your settings.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((g) => {
        const offsets = [...new Set(g.items.map((i) => i.offsetMinutes))].sort((a, b) => b - a);
        return (
          <li key={g.contest.id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <PlatformMark platform={g.contest.platform} />
              <div className="min-w-0">
                <a href={g.contest.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-ink hover:text-violet-soft">
                  {g.contest.name}
                </a>
                <p className="num text-xs text-fog">
                  Starts {formatDateTime(g.contest.startTime, timezone)} {zoneLabel(timezone, new Date(g.contest.startTime))}
                </p>
              </div>
              {g.contest.isSample && <SampleBadge />}
            </div>
            <ul className="flex flex-wrap gap-2 text-xs">
              {offsets.map((o) => {
                const items = g.items.filter((i) => i.offsetMinutes === o);
                const retrying = items.find((i) => i.attempts > 0 && i.lastError);
                return (
                  <li key={o} className="rounded-full border border-line px-2.5 py-1 text-ink-2" title={retrying?.lastError ?? undefined}>
                    <span className="num">{formatOffset(o)}</span> before, {formatDateTime(items[0].fireAt, timezone, { weekday: undefined })}, via {items.map((i) => CH[i.channel]).join(" + ")}
                    {retrying && <span className="text-amber"> (retrying)</span>}
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" size="sm" onClick={() => exclude(g.contest.id)} disabled={busy === g.contest.id} aria-label={`Cancel reminders for ${g.contest.name}`}>
              {busy === g.contest.id ? <Loader2 className="animate-spin" /> : <BellOff />} Cancel
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
