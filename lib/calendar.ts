import { dayKey } from "@/lib/time";

export interface CalDay {
  key: string; // YYYY-MM-DD (a calendar date, not an instant)
  y: number;
  m: number; // 1-12
  d: number;
  inMonth: boolean;
  weekday: number; // 0 = Monday
}

const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/** Pure calendar arithmetic on dates (UTC noon avoids any DST edge). */
export function addDays(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d, 12) + n * 86_400_000);
  return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function weekdayOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: string): string {
  return addDays(key, -weekdayOf(key));
}

/** 6x7 grid of days for a month, weeks starting Monday. */
export function monthGrid(y: number, m: number): CalDay[] {
  const first = keyOf(y, m, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const k = addDays(start, i);
    const p = parseKey(k);
    return { key: k, ...p, inMonth: p.m === m, weekday: i % 7 };
  });
}

export function weekDays(anchorKey: string): CalDay[] {
  const start = startOfWeek(anchorKey);
  const { m } = parseKey(anchorKey);
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(start, i);
    const p = parseKey(k);
    return { key: k, ...p, inMonth: p.m === m, weekday: i };
  });
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Minutes since local midnight of an instant in a timezone (0..1439). */
export function minutesIntoDay(instant: Date | string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(instant));
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const mi = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + mi;
}

/** Day keys (in tz) that a contest touches, so long contests show on every day they run. */
export function contestDayKeys(start: string, end: string, tz: string, max = 14): string[] {
  const first = dayKey(start, tz);
  const last = dayKey(new Date(new Date(end).getTime() - 1), tz);
  const out = [first];
  let k = first;
  while (k < last && out.length < max) {
    k = addDays(k, 1);
    out.push(k);
  }
  return out;
}
