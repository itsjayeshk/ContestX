import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { parseCodeforces, parseDivision } from "@/lib/providers/codeforces";
import { parseCodeChef } from "@/lib/providers/codechef";
import { parseLeetCode } from "@/lib/providers/leetcode";
import { backoffDelay, fetchJsonWithRetry } from "@/lib/providers/http";
import { PermanentProviderError, fallbackContestKey } from "@/lib/providers/types";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const NOW = new Date("2026-10-25T00:00:00Z");

describe("Codeforces adapter", () => {
  it("normalizes contests, keeps recent past ones, drops ancient and unscheduled rounds", () => {
    const { contests, skipped } = parseCodeforces(fixture("codeforces"), NOW, 30);
    expect(contests.map((c) => c.providerContestId)).toEqual(["2201", "2199", "2198", "2190"]);
    expect(skipped).toBe(1);
    const first = contests[0];
    expect(first.startTime.toISOString()).toBe("2026-10-26T14:35:00.000Z");
    expect(first.durationSeconds).toBe(7200);
    expect(first.url).toBe("https://codeforces.com/contests/2201");
    expect(first.division).toBe("Div. 2");
    expect(contests[2].division).toBe("Div. 1 + 2");
  });

  it("throws (never returns an empty schedule) on API failure status", () => {
    expect(() => parseCodeforces({ status: "FAILED", comment: "Call limit exceeded" }, NOW)).toThrow(/Call limit/);
    expect(() => parseCodeforces("nonsense", NOW)).toThrow(PermanentProviderError);
  });

  it("parses divisions", () => {
    expect(parseDivision("Educational Codeforces Round 185 (Rated for Div. 2)")).toBe("Div. 2");
    expect(parseDivision("Codeforces Global Round 31")).toBe("Global");
    expect(parseDivision("Kotlin Heroes")).toBeNull();
  });
});

describe("CodeChef adapter", () => {
  it("normalizes ISO dates with offsets to UTC and computes durations", () => {
    const { contests, skipped } = parseCodeChef(fixture("codechef"), NOW, 30);
    const s215 = contests.find((c) => c.providerContestId === "START215")!;
    expect(s215.startTime.toISOString()).toBe("2026-10-29T14:30:00.000Z");
    expect(s215.durationSeconds).toBe(7200);
    expect(s215.url).toBe("https://www.codechef.com/START215");
    expect(contests.find((c) => c.providerContestId === "START216")!.durationSeconds).toBe(7200);
    expect(contests.find((c) => c.providerContestId === "START216")!.division).toBe("Div. 2");
    expect(contests.some((c) => c.providerContestId === "PRACTICE")).toBe(false); // older than window
    expect(contests.some((c) => c.providerContestId === "START214")).toBe(true);
    expect(skipped).toBe(1);
  });

  it("rejects responses without contest lists", () => {
    expect(() => parseCodeChef({ status: "success" }, NOW)).toThrow(PermanentProviderError);
    expect(() => parseCodeChef({ status: "error" }, NOW)).toThrow();
  });
});

describe("LeetCode adapter", () => {
  it("normalizes upcoming contests", () => {
    const { contests, skipped } = parseLeetCode(fixture("leetcode"));
    expect(contests).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(contests[0]).toMatchObject({
      providerContestId: "weekly-contest-474",
      kind: "Weekly",
      durationSeconds: 5400,
      url: "https://leetcode.com/contest/weekly-contest-474/",
    });
    expect(contests[1].kind).toBe("Biweekly");
    expect(contests[0].startTime.toISOString()).toBe("2026-11-01T02:30:00.000Z");
  });

  it("treats GraphQL errors as failures, not as an empty list", () => {
    expect(() => parseLeetCode({ errors: [{ message: "blocked" }] })).toThrow(/blocked/);
    expect(() => parseLeetCode({ data: null })).toThrow();
  });
});

describe("fallback keys", () => {
  it("are deterministic and slugged", () => {
    const k = fallbackContestKey("Starters 99 — Special!", new Date("2026-11-01T10:00:00Z"));
    expect(k).toBe("starters-99-special@2026-11-01");
    expect(fallbackContestKey("Starters 99 — Special!", new Date("2026-11-01T18:00:00Z"))).toBe(k);
  });
});

describe("HTTP retry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("backs off exponentially with a cap", () => {
    expect(backoffDelay(0, 1000, () => 1)).toBe(1000);
    expect(backoffDelay(3, 1000, () => 1)).toBe(8000);
    expect(backoffDelay(10, 1000, () => 1)).toBe(30000);
    expect(backoffDelay(2, 1000, () => 0)).toBe(2000);
  });

  it("retries 5xx then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchJsonWithRetry("https://example.com/x", {}, { sleep: async () => {} });
    expect(res).toEqual({ body: { ok: 1 }, attempts: 2 });
  });

  it("does not retry 4xx and reports attempts on final failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 403 })));
    await expect(fetchJsonWithRetry("https://example.com/x", {}, { sleep: async () => {} })).rejects.toBeInstanceOf(PermanentProviderError);
    const failing = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", failing);
    await expect(fetchJsonWithRetry("https://example.com/x", {}, { retries: 2, sleep: async () => {} })).rejects.toMatchObject({ attempts: 3 });
    expect(failing).toHaveBeenCalledTimes(3);
  });
});
