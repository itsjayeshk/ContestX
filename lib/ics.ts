import { platformName } from "@/lib/platforms";
import type { PlatformId } from "@/types/contest";

export interface IcsEvent {
  uid: string;
  name: string;
  platform: PlatformId;
  start: Date;
  end: Date;
  url: string;
  cancelled?: boolean;
  sequence?: number;
  alarmsMinutes?: number[];
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines at 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    const max = first ? 75 : 74;
    let end = Math.min(i + max, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 char
    out.push((first ? "" : " ") + bytes.subarray(i, end).toString("utf8"));
    i = end;
    first = false;
  }
  return out.join("\r\n");
}

export function buildIcs(events: IcsEvent[], calName = "ContestX contests", now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ContestX//Contest Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@contestx`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SEQUENCE:${e.sequence ?? 0}`,
      `SUMMARY:${esc(`${e.name} (${platformName(e.platform)})`)}`,
      `DESCRIPTION:${esc(`${platformName(e.platform)} contest\n${e.url}`)}`,
      `URL:${e.url}`,
      `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    );
    for (const m of e.alarmsMinutes ?? []) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.name)}`, `TRIGGER:-PT${m}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

