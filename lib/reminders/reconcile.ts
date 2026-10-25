import type { Channel, PrismaClient } from "@/generated/prisma/client";
import { ALLOWED_OFFSETS } from "@/types/contest";

/** Reminders whose fire time passed more than this long ago are not created (no stale "24h" alerts). */
export const CREATE_GRACE_MS = 2 * 60_000;

export interface ChannelAvailability {
  email: boolean;
  push: boolean;
}

interface Desired {
  contestId: string;
  offsetMinutes: number;
  channel: Channel;
  scheduleVersion: number;
  fireAt: Date;
}

const keyOf = (r: { contestId: string; offsetMinutes: number; channel: Channel; scheduleVersion: number }) =>
  `${r.contestId}|${r.offsetMinutes}|${r.channel}|${r.scheduleVersion}`;

export function sanitizeOffsets(list: number[]): number[] {
  return [...new Set(list.filter((o) => ALLOWED_OFFSETS.includes(o)))].sort((a, b) => b - a);
}

/**
 * Make the ScheduledReminder table match each user's preferences for every upcoming,
 * non-cancelled contest. Idempotent: running it twice changes nothing; the unique key
 * (user, contest, offset, channel, scheduleVersion) prevents duplicates even if two
 * workers reconcile concurrently.
 */
export async function reconcileReminders(
  db: PrismaClient,
  availability: ChannelAvailability,
  opts: { now?: Date; userIds?: string[] } = {},
): Promise<{ created: number; cancelled: number; revived: number }> {
  const now = opts.now ?? new Date();
  const totals = { created: 0, cancelled: 0, revived: 0 };

  const contests = await db.contest.findMany({
    where: { state: "SCHEDULED", startTime: { gt: now } },
    select: { id: true, platform: true, startTime: true, scheduleVersion: true },
  });
  const contestIds = contests.map((c) => c.id);

  const users = await db.user.findMany({
    where: opts.userIds ? { id: { in: opts.userIds } } : {},
    select: {
      id: true,
      reminderPreference: true,
      bookmarks: { where: { contestId: { in: contestIds } }, select: { contestId: true } },
      contestPreferences: { where: { contestId: { in: contestIds } } },
      _count: { select: { pushSubscriptions: true } },
    },
  });

  for (const user of users) {
    const pref = user.reminderPreference;
    const channels: Channel[] = [];
    if (pref?.enabled) {
      if (pref.inAppEnabled) channels.push("IN_APP");
      if (pref.emailEnabled && availability.email) channels.push("EMAIL");
      if (pref.pushEnabled && availability.push && user._count.pushSubscriptions > 0) channels.push("PUSH");
    }
    const bookmarked = new Set(user.bookmarks.map((b) => b.contestId));
    const cprefs = new Map(user.contestPreferences.map((p) => [p.contestId, p]));

    const desired: Desired[] = [];
    if (pref && channels.length) {
      for (const c of contests) {
        if (!pref.platforms.includes(c.platform)) continue;
        const cp = cprefs.get(c.id);
        if (cp?.excluded) continue;
        if (pref.scope === "BOOKMARKED_ONLY" && !bookmarked.has(c.id) && !cp?.hasOverride) continue;
        const offsets = sanitizeOffsets(cp?.hasOverride ? cp.offsetsOverride : pref.offsetsMinutes);
        for (const offsetMinutes of offsets) {
          const fireAt = new Date(c.startTime.getTime() - offsetMinutes * 60_000);
          if (fireAt.getTime() < now.getTime() - CREATE_GRACE_MS) continue;
          for (const channel of channels) {
            desired.push({ contestId: c.id, offsetMinutes, channel, scheduleVersion: c.scheduleVersion, fireAt });
          }
        }
      }
    }

    const existing = await db.scheduledReminder.findMany({
      where: { userId: user.id, contestId: { in: contestIds } },
      select: { id: true, contestId: true, offsetMinutes: true, channel: true, scheduleVersion: true, status: true, fireAt: true },
    });
    const desiredKeys = new Set(desired.map(keyOf));
    const existingByKey = new Map(existing.map((e) => [keyOf(e), e]));

    const toCancel = existing.filter((e) => e.status === "PENDING" && !desiredKeys.has(keyOf(e))).map((e) => e.id);
    if (toCancel.length) {
      const r = await db.scheduledReminder.updateMany({
        where: { id: { in: toCancel }, status: "PENDING" },
        data: { status: "CANCELLED", lastError: "No longer matches preferences or schedule" },
      });
      totals.cancelled += r.count;
    }

    const toRevive = desired
      .map((d) => existingByKey.get(keyOf(d)))
      .filter((e): e is NonNullable<typeof e> => !!e && e.status === "CANCELLED" && e.fireAt.getTime() > now.getTime() - CREATE_GRACE_MS)
      .map((e) => e.id);
    if (toRevive.length) {
      const r = await db.scheduledReminder.updateMany({
        where: { id: { in: toRevive }, status: "CANCELLED" },
        data: { status: "PENDING", attempts: 0, nextAttemptAt: null, lastError: null, lockedAt: null, lockedBy: null },
      });
      totals.revived += r.count;
    }

    const toCreate = desired.filter((d) => !existingByKey.has(keyOf(d)));
    if (toCreate.length) {
      const r = await db.scheduledReminder.createMany({
        data: toCreate.map((d) => ({ ...d, userId: user.id })),
        skipDuplicates: true,
      });
      totals.created += r.count;
    }
  }

  // Pending reminders for contests that were cancelled, rescheduled or already started.
  const orphaned = await db.$executeRaw`
    UPDATE "ScheduledReminder" r
       SET "status" = 'CANCELLED', "lastError" = 'Contest cancelled, rescheduled or already started', "updatedAt" = ${now}
      FROM "Contest" c
     WHERE r."contestId" = c."id" AND r."status" = 'PENDING'
       AND (c."state" = 'CANCELLED' OR r."scheduleVersion" <> c."scheduleVersion" OR c."startTime" <= ${now})`;
  totals.cancelled += orphaned;
  return totals;
}
