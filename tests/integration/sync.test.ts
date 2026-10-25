import { describe, expect, it } from "vitest";
import { syncProvider } from "@/lib/sync/sync-provider";
import { fakeProvider, nc, testDb } from "./db";

const NOW = new Date("2026-10-25T00:00:00Z");
const later = (h: number) => new Date(NOW.getTime() + h * 3600_000);

describe("provider sync", () => {
  it("creates contests and deduplicates by platform + provider id", async () => {
    const p = fakeProvider("CODEFORCES", () => [nc("1", "2026-10-26T14:35:00Z"), nc("1", "2026-10-26T14:35:00Z"), nc("2", "2026-10-28T14:35:00Z")]);
    const r = await syncProvider(testDb, p, { now: NOW });
    expect(r).toMatchObject({ status: "SUCCESS", fetched: 2, created: 2 });
    const again = await syncProvider(testDb, p, { now: later(1) });
    expect(again).toMatchObject({ created: 0, updated: 0 });
    expect(await testDb.contest.count()).toBe(2);
    const c = await testDb.contest.findFirstOrThrow({ where: { providerContestId: "1" } });
    expect(c.endTime.toISOString()).toBe("2026-10-26T16:35:00.000Z");
  });

  it("detects start-time changes and bumps the schedule version", async () => {
    let start = "2026-10-26T14:35:00Z";
    const p = fakeProvider("CODEFORCES", () => [nc("1", start)]);
    await syncProvider(testDb, p, { now: NOW });
    start = "2026-10-27T14:35:00Z";
    const r = await syncProvider(testDb, p, { now: later(1) });
    expect(r.rescheduled).toBe(1);
    const c = await testDb.contest.findFirstOrThrow();
    expect(c.scheduleVersion).toBe(1);
    expect(c.previousStartTime?.toISOString()).toBe("2026-10-26T14:35:00.000Z");
    expect(c.startTime.toISOString()).toBe("2026-10-27T14:35:00.000Z");
  });

  it("cancels an upcoming contest only after it is missing from two successful syncs", async () => {
    let list = [nc("1", "2026-10-26T14:35:00Z"), nc("2", "2026-10-28T14:35:00Z")];
    const p = fakeProvider("CODEFORCES", () => list);
    await syncProvider(testDb, p, { now: NOW });
    list = [nc("1", "2026-10-26T14:35:00Z")];
    await syncProvider(testDb, p, { now: later(1) });
    expect((await testDb.contest.findFirstOrThrow({ where: { providerContestId: "2" } })).state).toBe("SCHEDULED");
    const r = await syncProvider(testDb, p, { now: later(2) });
    expect(r.cancelled).toBe(1);
    expect((await testDb.contest.findFirstOrThrow({ where: { providerContestId: "2" } })).state).toBe("CANCELLED");
  });

  it("keeps last good data and logs FAILED when the provider is down", async () => {
    await syncProvider(testDb, fakeProvider("CODECHEF", () => [nc("S1", "2026-10-29T14:30:00Z", 7200, "CODECHEF")]), { now: NOW });
    const r = await syncProvider(testDb, fakeProvider("CODECHEF", () => new Error("HTTP 503")), { now: later(1) });
    expect(r.status).toBe("FAILED");
    expect(await testDb.contest.count({ where: { platform: "CODECHEF", state: "SCHEDULED" } })).toBe(1);
    const log = await testDb.providerSyncLog.findFirstOrThrow({ where: { status: "FAILED" } });
    expect(log).toMatchObject({ attempts: 4, error: "HTTP 503" });
  });

  it("never treats an empty response as 'no contests' when contests are known", async () => {
    await syncProvider(testDb, fakeProvider("LEETCODE", () => [nc("w1", "2026-11-01T02:30:00Z", 5400, "LEETCODE")]), { now: NOW });
    const empty = fakeProvider("LEETCODE", () => []);
    for (const h of [1, 2, 3]) {
      const r = await syncProvider(testDb, empty, { now: later(h) });
      expect(r.status).toBe("PARTIAL");
    }
    expect((await testDb.contest.findFirstOrThrow()).state).toBe("SCHEDULED");
  });

  it("one provider failing does not affect another platform's data", async () => {
    await syncProvider(testDb, fakeProvider("CODEFORCES", () => [nc("1", "2026-10-26T14:35:00Z")]), { now: NOW });
    await syncProvider(testDb, fakeProvider("LEETCODE", () => new Error("down")), { now: NOW });
    expect(await testDb.contest.count({ where: { platform: "CODEFORCES" } })).toBe(1);
  });

  it("serializes concurrent syncs of the same platform with a lease", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = {
      ...fakeProvider("CODEFORCES", () => []),
      async fetchContests() {
        await gate;
        return { contests: [nc("1", "2026-10-26T14:35:00Z")], skipped: 0, attempts: 1 };
      },
    };
    const a = syncProvider(testDb, slow, { now: NOW, owner: "a" });
    await new Promise((r) => setTimeout(r, 50));
    const b = await syncProvider(testDb, slow, { now: NOW, owner: "b" });
    expect(b.status).toBe("LOCKED");
    release();
    expect((await a).status).toBe("SUCCESS");
  });
});
