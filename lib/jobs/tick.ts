import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { allProviders } from "@/lib/providers";
import { buildSenders, channelAvailability } from "@/lib/notify";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { dispatchDue } from "@/lib/reminders/dispatch";
import { pruneOldContests, syncProvider, type SyncOutcome } from "@/lib/sync/sync-provider";
import { PLATFORMS } from "@/types/contest";

export interface TickOptions {
  workerId: string;
  syncIntervalMinutes: number;
  retentionDays: number;
  appUrl: string;
  /** Force a sync regardless of when the last one ran (admin "sync now"). */
  forceSync?: boolean;
}

/** Has any platform gone longer than the interval without a sync attempt? */
export async function syncIsDue(db: PrismaClient, intervalMinutes: number, now = new Date()): Promise<boolean> {
  const latest = await db.providerSyncLog.groupBy({ by: ["platform"], _max: { startedAt: true } });
  if (latest.length < PLATFORMS.length) return true;
  return latest.some((l) => !l._max.startedAt || now.getTime() - l._max.startedAt.getTime() >= intervalMinutes * 60_000);
}

export async function runSync(db: PrismaClient, opts: Pick<TickOptions, "workerId" | "retentionDays">): Promise<SyncOutcome[]> {
  const providers = allProviders(opts.retentionDays);
  // Providers are independent: one failing never blocks the others.
  const results = await Promise.allSettled(PLATFORMS.map((p) => syncProvider(db, providers[p], { owner: opts.workerId })));
  const outcomes = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { platform: PLATFORMS[i], status: "FAILED" as const, fetched: 0, created: 0, updated: 0, rescheduled: 0, cancelled: 0, error: String(r.reason) },
  );
  const pruned = await pruneOldContests(db, opts.retentionDays);
  if (pruned) logger.info({ pruned }, "pruned old contests");
  return outcomes;
}

/** One unit of background work. Safe to run concurrently from several processes. */
export async function runTick(db: PrismaClient, opts: TickOptions) {
  const now = new Date();
  let sync: SyncOutcome[] | null = null;
  if (opts.forceSync || (await syncIsDue(db, opts.syncIntervalMinutes, now))) {
    sync = await runSync(db, opts);
  }
  const reconcile = await reconcileReminders(db, channelAvailability());
  const dispatch = await dispatchDue(db, { senders: buildSenders(db), workerId: opts.workerId, appUrl: opts.appUrl });
  return { sync, reconcile, dispatch };
}
