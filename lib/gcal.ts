import { platformName } from "@/lib/platforms";
import type { PlatformId } from "@/types/contest";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: { name: string; platform: PlatformId; start: Date | string; end: Date | string; url: string }): string {
  const s = new Date(e.start);
  const en = new Date(e.end);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${e.name} (${platformName(e.platform)})`,
    dates: `${stamp(s)}/${stamp(en)}`,
    details: e.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
