import { describe, expect, it } from "vitest";
import { contestPhase, countdown, dayKey, formatDuration, formatTime, isValidTimezone } from "@/lib/time";
import { reminderMessage } from "@/lib/notify/templates";

describe("time helpers", () => {
  it("computes contest phase", () => {
    const s = "2026-10-26T14:35:00Z";
    const e = "2026-10-26T16:35:00Z";
    expect(contestPhase(s, e, new Date("2026-10-26T14:00:00Z"))).toBe("upcoming");
    expect(contestPhase(s, e, new Date("2026-10-26T15:00:00Z"))).toBe("ongoing");
    expect(contestPhase(s, e, new Date("2026-10-26T16:35:00Z"))).toBe("ended");
  });

  it("counts down and never goes negative", () => {
    const c = countdown("2026-10-27T01:01:01Z", new Date("2026-10-26T00:00:00Z"));
    expect(c).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(countdown("2020-01-01T00:00:00Z").totalMs).toBe(0);
  });

  it("formats durations", () => {
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(86400 * 10)).toBe("10d");
  });

  it("renders Asia/Kolkata correctly", () => {
    expect(formatTime("2026-10-26T14:35:00Z", "Asia/Kolkata")).toBe("20:05");
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
  });

  it("handles a DST transition: same UTC instant, correct local wall time", () => {
    // US clocks fall back on 2026-11-01 at 02:00 local.
    expect(formatTime("2026-11-01T05:30:00Z", "America/New_York")).toBe("01:30"); // EDT
    expect(formatTime("2026-11-01T06:30:00Z", "America/New_York")).toBe("01:30"); // EST, an hour later
    expect(dayKey("2026-11-01T03:59:00Z", "America/New_York")).toBe("2026-10-31");
  });

  it("builds reminder copy that mentions a schedule change", () => {
    const m = reminderMessage({
      contestName: "Weekly Contest 474",
      platform: "LEETCODE",
      startTime: new Date("2026-11-01T02:30:00Z"),
      durationSeconds: 5400,
      url: "https://leetcode.com/contest/weekly-contest-474/",
      offsetMinutes: 60,
      timezone: "Asia/Kolkata",
      now: new Date("2026-11-01T01:30:00Z"),
      previousStartTime: new Date("2026-11-01T02:00:00Z"),
      appUrl: "http://localhost:3000",
    });
    expect(m.title).toBe("Weekly Contest 474 starts in 60m");
    expect(m.body).toContain("Schedule changed");
    expect(m.html).not.toContain("<script");
  });
});

import { zoneLabel, zoneOffsetMinutes } from "@/lib/time";
describe("zone labels", () => {
  it("are deterministic and DST-aware", () => {
    expect(zoneLabel("Asia/Kolkata")).toBe("IST");
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-10-31T12:00:00Z"))).toBe(-240);
    expect(zoneLabel("America/New_York", new Date("2026-11-02T12:00:00Z"))).toBe("UTC-5");
    expect(zoneLabel("Asia/Kathmandu", new Date("2026-11-02T12:00:00Z"))).toBe("UTC+5:45");
  });
});
