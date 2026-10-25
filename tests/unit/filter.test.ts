import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterContests, nextContest } from "@/lib/filter-contests";
import type { ContestDTO } from "@/types/contest";

const mk = (id: string, platform: ContestDTO["platform"], start: string, hours = 2, extra: Partial<ContestDTO> = {}): ContestDTO => ({
  id, platform, name: `Contest ${id}`, url: "https://x", startTime: start,
  endTime: new Date(new Date(start).getTime() + hours * 3600_000).toISOString(), durationSeconds: hours * 3600,
  division: null, kind: null, cancelled: false, scheduleChangedAt: null, previousStartTime: null, isSample: false, lastFetchedAt: start, ...extra,
});

const now = new Date("2026-10-25T10:00:00Z"); // 15:30 IST
const list = [
  mk("past", "CODEFORCES", "2026-10-20T10:00:00Z"),
  mk("live", "CODECHEF", "2026-10-25T09:00:00Z"),
  mk("tonight", "LEETCODE", "2026-10-25T16:00:00Z"), // 21:30 IST, today
  mk("after-midnight-ist", "CODEFORCES", "2026-10-25T19:00:00Z"), // 00:30 IST next day
  mk("in10d", "CODECHEF", "2026-11-04T10:00:00Z"),
  mk("cancelled", "LEETCODE", "2026-10-26T10:00:00Z", 2, { cancelled: true }),
];

describe("filterContests", () => {
  it("defaults to upcoming and ongoing, soonest first", () => {
    expect(filterContests(list, DEFAULT_FILTERS, now, "Asia/Kolkata").map((c) => c.id)).toEqual(["live", "tonight", "after-midnight-ist", "cancelled", "in10d"]);
  });
  it("'today' respects the viewer's timezone", () => {
    const f = { ...DEFAULT_FILTERS, range: "today" as const };
    expect(filterContests(list, f, now, "Asia/Kolkata").map((c) => c.id)).toEqual(["live", "tonight"]);
    expect(filterContests(list, f, now, "UTC").map((c) => c.id)).toEqual(["live", "tonight", "after-midnight-ist"]);
  });
  it("filters by platform, range, search and phase", () => {
    expect(filterContests(list, { ...DEFAULT_FILTERS, platforms: ["CODECHEF"] }, now, "UTC").map((c) => c.id)).toEqual(["live", "in10d"]);
    expect(filterContests(list, { ...DEFAULT_FILTERS, range: "7d" }, now, "UTC").map((c) => c.id)).not.toContain("in10d");
    expect(filterContests(list, { ...DEFAULT_FILTERS, query: "TONIGHT" }, now, "UTC").map((c) => c.id)).toEqual(["tonight"]);
    expect(filterContests(list, { ...DEFAULT_FILTERS, phases: ["ended"] }, now, "UTC").map((c) => c.id)).toEqual(["past"]);
  });
  it("finds the next non-cancelled contest", () => {
    expect(nextContest(list, now)?.id).toBe("tonight");
    expect(nextContest(list, now, ["CODECHEF"])?.id).toBe("in10d");
    expect(nextContest([], now)).toBeNull();
  });
});
