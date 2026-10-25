import type { Channel, PrismaClient } from "@/generated/prisma/client";
import { backoffDelay } from "@/lib/providers/http";
import { logger } from "@/lib/logger";
import { reminderMessage } from "@/lib/notify/templates";
import type { Sender } from "@/lib/notify/types";

export const MAX_ATTEMPTS = 5;
/** A PROCESSING row whose lock is older than this is assumed orphaned by a crashed worker. */
export const STALE_LOCK_MS = 5 * 60_000;

export interface DispatchDeps {
  senders: Record<Channel, Sender>;
  workerId: string;
  appUrl: string;
  now?: () => Date;
  batchSize?: number;
  retryBaseMs?: number;
}

export interface DispatchSummary {
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
  skipped: number;
  cancelled: number;
}

interface Claimed {
  id: string;
  attempts: number;
}

/**
 * Atomically claim due reminders. FOR UPDATE SKIP LOCKED means two workers running at
 * the same moment never claim the same row.
 */
export async function claimDue(db: PrismaClient, workerId: string, now: Date, batchSize: number): Promise<Claimed[]> {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return db.$queryRaw<Claimed[]>`
    UPDATE "ScheduledReminder" r
       SET "status" = 'PROCESSING', "lockedAt" = ${now}, "lockedBy" = ${workerId},
           "attempts" = r."attempts" + 1, "updatedAt" = ${now}
     WHERE r."id" IN (
       SELECT "id" FROM "ScheduledReminder"
        WHERE ("status" = 'PENDING' AND "fireAt" <= ${now} AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now}))
           OR ("status" = 'PROCESSING' AND "lockedAt" < ${staleBefore})
        ORDER BY "fireAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED)
    RETURNING r."id", r."attempts"`;
}

export async function dispatchDue(db: PrismaClient, deps: DispatchDeps): Promise<DispatchSummary> {
  const nowFn = deps.now ?? (() => new Date());
  const summary: DispatchSummary = { claimed: 0, sent: 0, failed: 0, retried: 0, skipped: 0, cancelled: 0 };
  const claimed = await claimDue(db, deps.workerId, nowFn(), deps.batchSize ?? 50);
  summary.claimed = claimed.length;
  for (const c of claimed) {
    try {
      const result = await processReminder(db, c, deps, nowFn());
      summary[result]++;
    } catch (err) {
      logger.error({ err, reminderId: c.id }, "reminder processing crashed; it will be reclaimed after the lock expires");
    }
  }
  return summary;
}

type Outcome = "sent" | "failed" | "retried" | "skipped" | "cancelled";

async function processReminder(db: PrismaClient, claim: Claimed, deps: DispatchDeps, now: Date): Promise<Outcome> {
  const log = logger.child({ component: "dispatch", reminderId: claim.id });
  const r = await db.scheduledReminder.findUnique({
    where: { id: claim.id },
    include: {
      contest: true,
      user: {
        select: {
          id: true,
          email: true,
          timezone: true,
          reminderPreference: true,
        },
      },
    },
  });
  if (!r) return "cancelled";

  // Only the worker that holds the lock may finish this row.
  const finish = (data: Parameters<PrismaClient["scheduledReminder"]["updateMany"]>[0]["data"]) =>
    db.scheduledReminder.updateMany({
      where: { id: r.id, status: "PROCESSING", lockedBy: deps.workerId },
      data: { lockedAt: null, lockedBy: null, ...data },
    });

  const cancel = async (reason: string): Promise<Outcome> => {
    await finish({ status: "CANCELLED", lastError: reason });
    log.info({ reason }, "reminder cancelled");
    return "cancelled";
  };

  // Already delivered by an earlier attempt that crashed before recording SENT.
  const prior = await db.notificationDelivery.findFirst({ where: { reminderId: r.id, status: "SUCCESS" } });
  if (prior) {
    await finish({ status: "SENT", sentAt: prior.createdAt });
    return "sent";
  }

  const contest = r.contest;
  if (contest.state === "CANCELLED") return cancel("Contest was cancelled or removed by the platform");
  if (r.scheduleVersion !== contest.scheduleVersion) return cancel("Contest was rescheduled; a new reminder replaces this one");

  const pref = r.user.reminderPreference;
  const cpref = await db.userContestPreference.findUnique({ where: { userId_contestId: { userId: r.userId, contestId: r.contestId } } });
  const channelOn =
    pref &&
    pref.enabled &&
    pref.platforms.includes(contest.platform) &&
    ((r.channel === "EMAIL" && pref.emailEnabled) || (r.channel === "PUSH" && pref.pushEnabled) || (r.channel === "IN_APP" && pref.inAppEnabled));
  if (!channelOn) return cancel("Reminder preferences changed");
  if (cpref?.excluded) return cancel("Contest excluded by user");

  if (now.getTime() >= contest.startTime.getTime()) {
    await finish({ status: "SKIPPED", lastError: "Contest had already started when the reminder came due" });
    await recordDelivery(db, r.id, r.userId, r.channel, claim.attempts, "SKIPPED", { title: contest.name, body: "Skipped: contest already started", url: contest.url }, null, "Contest already started");
    return "skipped";
  }

  const message = reminderMessage({
    contestName: contest.name,
    platform: contest.platform,
    startTime: contest.startTime,
    durationSeconds: contest.durationSeconds,
    url: contest.url,
    offsetMinutes: r.offsetMinutes,
    timezone: r.user.timezone,
    now,
    previousStartTime: contest.scheduleChangedAt ? contest.previousStartTime : null,
    appUrl: deps.appUrl,
  });

  const sender = deps.senders[r.channel];
  const res = await sender({ reminderId: r.id, userId: r.userId, email: r.user.email, message, idempotencyKey: `reminder-${r.id}` });

  if (res.ok) {
    await recordDelivery(db, r.id, r.userId, r.channel, claim.attempts, "SUCCESS", message, res.providerMessageId ?? null, null);
    await finish({ status: "SENT", sentAt: now, lastError: null, nextAttemptAt: null });
    log.info({ channel: r.channel }, "reminder delivered");
    return "sent";
  }

  await recordDelivery(db, r.id, r.userId, r.channel, claim.attempts, "FAILED", message, null, res.error);
  const retryAt = new Date(now.getTime() + backoffDelay(claim.attempts - 1, deps.retryBaseMs ?? 30_000));
  if (res.transient && claim.attempts < MAX_ATTEMPTS && retryAt < contest.startTime) {
    await finish({ status: "PENDING", nextAttemptAt: retryAt, lastError: res.error });
    log.warn({ channel: r.channel, error: res.error, retryAt }, "delivery failed; will retry");
    return "retried";
  }
  await finish({ status: "FAILED", lastError: res.error });
  log.error({ channel: r.channel, error: res.error }, "delivery failed permanently");
  return "failed";
}

async function recordDelivery(
  db: PrismaClient,
  reminderId: string,
  userId: string,
  channel: Channel,
  attempt: number,
  status: "SUCCESS" | "FAILED" | "SKIPPED",
  message: { title: string; body: string; url: string },
  providerMessageId: string | null,
  error: string | null,
) {
  try {
    await db.notificationDelivery.create({
      data: { reminderId, userId, channel, attempt, status, title: message.title, body: message.body, url: message.url, providerMessageId, error: error?.slice(0, 1000) },
    });
  } catch (err) {
    // Unique (reminderId, attempt): another worker already recorded this attempt.
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
}
