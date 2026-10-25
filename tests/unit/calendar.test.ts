import { describe, expect, it } from "vitest";
import { addDays, contestDayKeys, minutesIntoDay, monthGrid, shiftMonth, startOfWeek, weekdayOf } from "@/lib/calendar";

describe("calendar math", () => {
  it("builds a Monday-first 6-week month grid", () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(42);
    expect(g[0].key).toBe("2026-09-28");
    expect(g.find((d) => d.key === "2026-10-01")?.weekday).toBe(3);
    expect(g.filter((d) => d.inMonth)).toHaveLength(31);
  });
  it("does date arithmetic across month/year and DST boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(weekdayOf("2026-10-26")).toBe(0);
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });
  it("places times and multi-day contests in the viewer's timezone", () => {
    expect(minutesIntoDay("2026-10-26T14:35:00Z", "Asia/Kolkata")).toBe(20 * 60 + 5);
    expect(contestDayKeys("2026-10-29T14:30:00Z", "2026-10-29T16:30:00Z", "Asia/Kolkata")).toEqual(["2026-10-29"]);
    expect(contestDayKeys("2026-10-29T17:30:00Z", "2026-10-31T19:00:00Z", "Asia/Kolkata")).toEqual(["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});
