import type { ContestPhase } from "@/types/contest";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [DEFAULT_TIMEZONE, "UTC"];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function contestPhase(start: Date | string, end: Date | string, now: Date = new Date()): ContestPhase {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = now.getTime();
  if (n < s) return "upcoming";
  if (n < e) return "ongoing";
  return "ended";
}

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(target: Date | string, now: Date = new Date()): Countdown {
  const totalMs = Math.max(0, new Date(target).getTime() - now.getTime());
  const totalSec = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function formatCountdownShort(target: Date | string, now: Date = new Date()): string {
  const c = countdown(target, now);
  if (c.totalMs <= 0) return "now";
  if (c.days > 0) return `in ${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `in ${c.hours}h ${c.minutes}m`;
  if (c.minutes > 0) return `in ${c.minutes}m`;
  return `in ${c.seconds}s`;
}

export function formatDateTime(d: Date | string, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...opts,
  }).format(new Date(d));
}

export function formatTime(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}

export function formatDayLong(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
}

/** Minutes the zone is ahead of UTC at a given instant (DST-aware). */
export function zoneOffsetMinutes(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

const NAMED_ZONES: Record<string, string> = { "Asia/Kolkata": "IST", "Asia/Calcutta": "IST", UTC: "UTC", "Etc/UTC": "UTC" };

/**
 * Short zone label such as "IST" or "UTC-4". Computed by hand rather than from Intl's
 * timeZoneName, because server and browser ICU data disagree on those names.
 */
export function zoneLabel(tz: string, at: Date = new Date()): string {
  if (NAMED_ZONES[tz]) return NAMED_ZONES[tz];
  const off = zoneOffsetMinutes(tz, at);
  const sign = off < 0 ? "-" : "+";
  const a = Math.abs(off);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

/** Calendar-day key (YYYY-MM-DD) of an instant in a timezone. Handles DST because Intl does. */
export function dayKey(d: Date | string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatOffset(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

export function relativeAgo(d: Date | string | null, now: Date = new Date()): string {
  if (!d) return "never";
  const diff = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

export function greeting(tz: string, now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)) % 24;
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
