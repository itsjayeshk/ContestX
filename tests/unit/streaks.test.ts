import { describe, expect, it } from "vitest";
import { computeStreaks, weekIndex } from "@/lib/streaks";
import { buildIcs } from "@/lib/ics";

describe("streaks", () => {
  const now = new Date("2026-10-25T12:00:00Z"); // Sunday
  it("counts consecutive weeks and keeps the streak alive through the current week", () => {
    const d = ["2026-10-04T10:00:00Z", "2026-10-11T10:00:00Z", "2026-10-18T10:00:00Z", "2026-10-15T10:00:00Z", "2026-08-01T10:00:00Z"];
    expect(computeStreaks(d, now)).toEqual({ current: 3, longest: 3, activeWeeks: 4 });
  });
  it("breaks after a missed week", () => {
    expect(computeStreaks(["2026-10-04T10:00:00Z"], now).current).toBe(0);
    expect(computeStreaks([], now)).toEqual({ current: 0, longest: 0, activeWeeks: 0 });
  });
  it("uses Monday-based weeks", () => {
    expect(weekIndex("2026-10-19T00:00:00Z")).toBe(weekIndex("2026-10-25T23:59:00Z"));
    expect(weekIndex("2026-10-26T00:00:00Z")).toBe(weekIndex("2026-10-25T00:00:00Z") + 1);
  });
});

describe("ics", () => {
  it("produces valid, folded VEVENTs with alarms and escaping", () => {
    const ics = buildIcs([
      { uid: "cf-1", name: "Round, with; special chars and a very long name that needs folding across lines", platform: "CODEFORCES", start: new Date("2026-10-26T14:35:00Z"), end: new Date("2026-10-26T16:35:00Z"), url: "https://codeforces.com/contests/1", alarmsMinutes: [60] },
    ], "Test", new Date("2026-10-25T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261026T143500Z");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("Round\\, with\; special");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
