import { describe, expect, it } from "vitest";
import type { Channel } from "@/generated/prisma/client";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { dispatchDue, MAX_ATTEMPTS } from "@/lib/reminders/dispatch";
import { syncProvider } from "@/lib/sync/sync-provider";
import type { Sender } from "@/lib/notify/types";
import { fakeProvider, makeUser, nc, testDb } from "./db";

const NOW = new Date("2026-10-25T00:00:00Z");
const START = "2026-10-26T14:35:00Z";
const avail = { email: true, push: true };

function recordingSenders(behaviour: (ch: Channel, n: number) => Awaited<ReturnType<Sender>> = () => ({ ok: true })) {
  const calls: { channel: Channel; reminderId: string | null; key: string }[] = [];
  const make =
    (channel: Channel): Sender =>
    async (ctx) => {
      calls.push({ channel, reminderId: ctx.reminderId, key: ctx.idempotencyKey });
      return behaviour(channel, calls.filter((c) => c.channel === channel).length);
    };
  return { calls, senders: { EMAIL: make("EMAIL"), PUSH: make("PUSH"), IN_APP: make("IN_APP") } };
}

async function seedContest(start = START) {
  await syncProvider(testDb, fakeProvider("CODEFORCES", () => [nc("1", start)]), { now: NOW });
  return testDb.contest.findFirstOrThrow();
}

describe("reminder reconciliation", () => {
  it("creates one reminder per offset and enabled channel, idempotently", async () => {
    await makeUser();
    await seedContest();
    const first = await reconcileReminders(testDb, avail, { now: NOW });
    expect(first.created).toBe(4); // 2 offsets x (email + in-app)
    const second = await reconcileReminders(testDb, avail, { now: NOW });
    expect(second).toEqual({ created: 0, cancelled: 0, revived: 0 });
    const rows = await testDb.scheduledReminder.findMany({ orderBy: { fireAt: "asc" } });
    expect(rows.map((r) => r.fireAt.toISOString())).toContain("2026-10-26T13:35:00.000Z");
  });

  it("skips channels the server cannot deliver and push without a subscription", async () => {
    await makeUser("p@test.dev", { pushEnabled: true });
    await seedContest();
    await reconcileReminders(testDb, { email: false, push: true }, { now: NOW });
    const channels = new Set((await testDb.scheduledReminder.findMany()).map((r) => r.channel));
    expect([...channels]).toEqual(["IN_APP"]);
  });

  it("respects exclusions, per-contest overrides and bookmark-only scope", async () => {
    const u = await makeUser("s@test.dev", { scope: "BOOKMARKED_ONLY", emailEnabled: false });
    const c = await seedContest();
    expect((await reconcileReminders(testDb, avail, { now: NOW })).created).toBe(0);
    await testDb.contestBookmark.create({ data: { userId: u.id, contestId: c.id } });
    expect((await reconcileReminders(testDb, avail, { now: NOW })).created).toBe(2);
    await testDb.userContestPreference.create({ data: { userId: u.id, contestId: c.id, hasOverride: true, offsetsOverride: [1440, 5] } });
    const r = await reconcileReminders(testDb, avail, { now: NOW });
    expect(r).toMatchObject({ created: 2, cancelled: 2 });
    await testDb.userContestPreference.update({ where: { userId_contestId: { userId: u.id, contestId: c.id } }, data: { excluded: true } });
    expect((await reconcileReminders(testDb, avail, { now: NOW })).cancelled).toBe(2);
    expect(await testDb.scheduledReminder.count({ where: { status: "PENDING" } })).toBe(0);
  });

  it("does not create reminders whose time has already passed", async () => {
    await makeUser();
    await seedContest("2026-10-25T10:00:00Z"); // 10h away: the 24h preset would be stale
    await testDb.reminderPreference.updateMany({ data: { offsetsMinutes: [1440, 60] } });
    await reconcileReminders(testDb, { email: false, push: false }, { now: NOW });
    const rows = await testDb.scheduledReminder.findMany();
    expect(rows.map((r) => r.offsetMinutes)).toEqual([60]);
  });

  it("recalculates pending reminders when a contest is rescheduled", async () => {
    await makeUser();
    await seedContest();
    await reconcileReminders(testDb, { email: false, push: false }, { now: NOW });
    await syncProvider(testDb, fakeProvider("CODEFORCES", () => [nc("1", "2026-10-27T14:35:00Z")]), { now: new Date(NOW.getTime() + 60_000) });
    await reconcileReminders(testDb, { email: false, push: false }, { now: NOW });
    const pending = await testDb.scheduledReminder.findMany({ where: { status: "PENDING" } });
    expect(pending).toHaveLength(2);
    expect(pending.every((p) => p.scheduleVersion === 1)).toBe(true);
    expect(pending.map((p) => p.fireAt.toISOString()).sort()).toEqual(["2026-10-27T13:35:00.000Z", "2026-10-27T14:20:00.000Z"]);
    expect(await testDb.scheduledReminder.count({ where: { status: "CANCELLED" } })).toBe(2);
  });
});

describe("reminder dispatch", () => {
  const dueTime = new Date("2026-10-26T14:21:00Z"); // both offsets (60m, 15m) are due

  it("delivers each due reminder exactly once even with concurrent workers", async () => {
    await makeUser("a@test.dev");
    await makeUser("b@test.dev");
    await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    const { calls, senders } = recordingSenders();
    const run = (id: string) => dispatchDue(testDb, { senders, workerId: id, appUrl: "http://x", now: () => dueTime });
    const results = await Promise.all([run("w1"), run("w2"), run("w3")]);
    expect(results.reduce((n, r) => n + r.sent, 0)).toBe(8);
    expect(calls).toHaveLength(8);
    expect(new Set(calls.map((c) => c.reminderId)).size).toBe(8);
    const again = await run("w1");
    expect(again.claimed).toBe(0);
    expect(await testDb.notificationDelivery.count({ where: { status: "SUCCESS" } })).toBe(8);
  });

  it("retries transient failures with backoff and then succeeds", async () => {
    await makeUser("r@test.dev", { inAppEnabled: false, offsetsMinutes: [60] });
    await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    const { calls, senders } = recordingSenders((_, n) => (n === 1 ? { ok: false, transient: true, error: "Resend 503" } : { ok: true, providerMessageId: "m1" }));
    let t = new Date("2026-10-26T13:36:00Z");
    const deps = { senders, workerId: "w", appUrl: "http://x", now: () => t, retryBaseMs: 1000 };
    expect((await dispatchDue(testDb, deps)).retried).toBe(1);
    expect((await dispatchDue(testDb, deps)).claimed).toBe(0); // not yet time to retry
    t = new Date(t.getTime() + 5000);
    expect((await dispatchDue(testDb, deps)).sent).toBe(1);
    expect(calls.map((c) => c.key)).toEqual([calls[0].key, calls[0].key]); // same idempotency key on retry
    const deliveries = await testDb.notificationDelivery.findMany({ orderBy: { attempt: "asc" } });
    expect(deliveries.map((d) => [d.attempt, d.status])).toEqual([[1, "FAILED"], [2, "SUCCESS"]]);
  });

  it("marks permanent failures FAILED and gives up after max attempts", async () => {
    await makeUser("f@test.dev", { inAppEnabled: false, offsetsMinutes: [1440] });
    await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    const { senders } = recordingSenders(() => ({ ok: false, transient: false, error: "Resend 422: invalid from" }));
    const r = await dispatchDue(testDb, { senders, workerId: "w", appUrl: "http://x", now: () => new Date("2026-10-25T14:36:00Z") });
    expect(r.failed).toBe(1);
    const row = await testDb.scheduledReminder.findFirstOrThrow();
    expect(row).toMatchObject({ status: "FAILED", lastError: "Resend 422: invalid from" });
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
  });

  it("skips reminders for contests that already started (e.g. worker was down)", async () => {
    await makeUser("d@test.dev", { emailEnabled: false, offsetsMinutes: [60] });
    await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    const { calls, senders } = recordingSenders();
    const r = await dispatchDue(testDb, { senders, workerId: "w", appUrl: "http://x", now: () => new Date("2026-10-26T15:00:00Z") });
    expect(r.skipped).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("reclaims reminders orphaned by a crashed worker without resending delivered ones", async () => {
    await makeUser("c@test.dev", { emailEnabled: false, offsetsMinutes: [60] });
    await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    const row = await testDb.scheduledReminder.findFirstOrThrow();
    // Simulate a crash after the in-app delivery was written but before SENT was recorded.
    await testDb.scheduledReminder.update({ where: { id: row.id }, data: { status: "PROCESSING", lockedBy: "dead", lockedAt: new Date("2026-10-26T13:35:00Z"), attempts: 1 } });
    await testDb.notificationDelivery.create({ data: { reminderId: row.id, userId: row.userId, channel: "IN_APP", status: "SUCCESS", title: "t", body: "b" } });
    const { calls, senders } = recordingSenders();
    const r = await dispatchDue(testDb, { senders, workerId: "w", appUrl: "http://x", now: () => new Date("2026-10-26T13:45:00Z") });
    expect(r.sent).toBe(1);
    expect(calls).toHaveLength(0);
    expect((await testDb.scheduledReminder.findFirstOrThrow()).status).toBe("SENT");
  });

  it("cancels at send time if the contest was rescheduled after the reminder was claimed", async () => {
    await makeUser("v@test.dev", { emailEnabled: false, offsetsMinutes: [60] });
    const c = await seedContest();
    await reconcileReminders(testDb, avail, { now: NOW });
    await testDb.contest.update({ where: { id: c.id }, data: { scheduleVersion: 5 } });
    const { calls, senders } = recordingSenders();
    const r = await dispatchDue(testDb, { senders, workerId: "w", appUrl: "http://x", now: () => new Date("2026-10-26T13:40:00Z") });
    expect(r.cancelled).toBe(1);
    expect(calls).toHaveLength(0);
  });
});
