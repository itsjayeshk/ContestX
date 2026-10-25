"use client";
import { useNow } from "@/hooks/use-now";
import { formatDayLong, zoneLabel } from "@/lib/time";

export function LocalClock({ timezone }: { timezone: string }) {
  const now = useNow();
  return (
    <div className="flex flex-col items-start gap-0.5 text-[13px] sm:items-end">
      <span className="text-ink-2">{now ? formatDayLong(now, timezone) : " "}</span>
      <span className="num text-fog">
        {now
          ? `${new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)} ${zoneLabel(timezone, now)}`
          : " "}
      </span>
    </div>
  );
}

export function Greeting({ timezone }: { timezone: string }) {
  const now = useNow();
  const h = now ? Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(now)) % 24 : null;
  const text = h === null ? "Hello" : h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return <>{text}, coder.</>;
}
