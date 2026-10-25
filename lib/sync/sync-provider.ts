import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { acquireLease, releaseLease } from "@/lib/lease";
import type { ContestProvider, NormalizedContest } from "@/lib/providers/types";

/** An upcoming contest is cancelled only after it is missing from this many successful fetches. */
export const MISSING_SYNCS_BEFORE_CANCEL = 2;

export interface SyncOutcome {
  platform: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "LOCKED";
  fetched: number;
  created: number;
  updated: number;
  rescheduled: number;
  cancelled: number;
  error?: string;
}

function dedupe(list: NormalizedContest[]): NormalizedContest[] {
  const map = new Map<string, NormalizedContest>();
  for (const c of list) if (!map.has(c.providerContestId)) map.set(c.providerContestId, c);
  return [...map.values()];
}

export async function syncProvider(
  db: PrismaClient,
  provider: ContestProvider,
  opts: { now?: Date; owner?: string } = {},
): Promise<SyncOutcome> {
  const now = opts.now ?? new Date();
  const owner = opts.owner ?? `sync-${process.pid}`;
  const platform = provider.platform;
  const log = logger.child({ component: "sync", platform });
  const base: SyncOutcome = { platform, status: "SUCCESS", fetched: 0, created: 0, updated: 0, rescheduled: 0, cancelled: 0 };

  if (!(await acquireLease(db, `sync:${platform}`, owner, 5 * 60_000, now))) {
    log.info("sync skipped: another worker holds the lease");
    return { ...base, status: "LOCKED" };
  }

  const started = Date.now();
  try {
    let result;
    try {
      result = await provider.fetchContests(now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (err as { attempts?: number }).attempts ?? 1;
      log.warn({ err: message, attempts }, "provider fetch failed; keeping last good data");
      await db.providerSyncLog.create({
        data: { platform, status: "FAILED", startedAt: now, finishedAt: new Date(), durationMs: Date.now() - started, attempts, error: message.slice(0, 1000) },
      });
      return { ...base, status: "FAILED", error: message };
    }

    const contests = dedupe(result.contests);
    const outcome: SyncOutcome = { ...base, fetched: contests.length };
    const notes: string[] = [];
    if (result.skipped > 0) notes.push(`${result.skipped} item(s) could not be parsed`);

    await db.$transaction(async (tx) => {
      const existing = await tx.contest.findMany({
        where: { platform, providerContestId: { in: contests.map((c) => c.providerContestId) } },
      });
      const byId = new Map(existing.map((e) => [e.providerContestId, e]));

      for (const c of contests) {
        const endTime = new Date(c.startTime.getTime() + c.durationSeconds * 1000);
        const prev = byId.get(c.providerContestId);
        if (!prev) {
          await tx.contest.create({
            data: {
              platform,
              providerContestId: c.providerContestId,
              name: c.name,
              url: c.url,
              startTime: c.startTime,
              durationSeconds: c.durationSeconds,
              endTime,
              division: c.division,
              kind: c.kind,
              source: c.source,
              firstSeenAt: now,
              lastSeenAt: now,
              lastFetchedAt: now,
            },
          });
          outcome.created++;
          continue;
        }
        const startChanged = prev.startTime.getTime() !== c.startTime.getTime();
        const fieldsChanged =
          startChanged ||
          prev.name !== c.name ||
          prev.url !== c.url ||
          prev.durationSeconds !== c.durationSeconds ||
          prev.division !== c.division ||
          prev.kind !== c.kind ||
          prev.state !== "SCHEDULED";
        await tx.contest.update({
          where: { id: prev.id },
          data: {
            name: c.name,
            url: c.url,
            durationSeconds: c.durationSeconds,
            endTime,
            division: c.division,
            kind: c.kind,
            source: c.source,
            state: "SCHEDULED",
            missingCount: 0,
            lastSeenAt: now,
            lastFetchedAt: now,
            ...(startChanged
              ? { startTime: c.startTime, previousStartTime: prev.startTime, scheduleChangedAt: now, scheduleVersion: { increment: 1 } }
              : {}),
          },
        });
        if (startChanged) {
          outcome.rescheduled++;
          log.info({ contest: c.providerContestId, from: prev.startTime.toISOString(), to: c.startTime.toISOString() }, "start time changed");
        }
        if (fieldsChanged) outcome.updated++;
      }

      // Stale handling: only upcoming, real contests that the platform stopped listing.
      const upcomingKnown = await tx.contest.findMany({
        where: { platform, isSample: false, state: "SCHEDULED", startTime: { gt: now } },
        select: { id: true, providerContestId: true, missingCount: true },
      });
      const listed = new Set(contests.map((c) => c.providerContestId));
      const missing = upcomingKnown.filter((c) => !listed.has(c.providerContestId));

      if (contests.length === 0 && upcomingKnown.length > 0) {
        // An empty answer while we know of upcoming contests is suspicious; never treat it as "no contests".
        notes.push(`empty response while ${upcomingKnown.length} upcoming contest(s) are known; nothing removed`);
      } else {
        for (const m of missing) {
          const count = m.missingCount + 1;
          const cancel = count >= MISSING_SYNCS_BEFORE_CANCEL;
          await tx.contest.update({
            where: { id: m.id },
            data: { missingCount: count, ...(cancel ? { state: "CANCELLED" } : {}) },
          });
          if (cancel) {
            outcome.cancelled++;
            log.info({ contest: m.providerContestId }, "contest no longer listed; marked cancelled");
          }
        }
      }
    }, { timeout: 30_000 });

    outcome.status = notes.length ? "PARTIAL" : "SUCCESS";
    if (notes.length) outcome.error = notes.join("; ");
    await db.providerSyncLog.create({
      data: {
        platform,
        status: outcome.status,
        startedAt: now,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        attempts: result.attempts,
        fetchedCount: outcome.fetched,
        createdCount: outcome.created,
        updatedCount: outcome.updated,
        rescheduledCount: outcome.rescheduled,
        cancelledCount: outcome.cancelled,
        error: outcome.error?.slice(0, 1000),
      },
    });
    log.info({ ...outcome }, "sync finished");
    return outcome;
  } finally {
    await releaseLease(db, `sync:${platform}`, owner).catch(() => undefined);
  }
}

/** Remove finished contests older than the retention window. */
export async function pruneOldContests(db: PrismaClient, retentionDays: number, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const res = await db.contest.deleteMany({ where: { endTime: { lt: cutoff } } });
  return res.count;
}
