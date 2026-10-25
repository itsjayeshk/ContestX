/**
 * ContestX background worker. Run as a long-lived process: `npm run worker`.
 *
 * All state lives in PostgreSQL, so restarts, redeploys and several workers running at
 * once are safe. The loop below only decides when to *look* at the database; it is not
 * what guarantees a reminder. A reminder that came due while the worker was down is
 * picked up on the next tick (or skipped and recorded if the contest has already started).
 */
import "dotenv/config";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { createPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runTick } from "@/lib/jobs/tick";

const db = createPrisma();
const workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const tickMs = Number(process.env.DISPATCH_INTERVAL_SECONDS ?? 30) * 1000;
const opts = {
  workerId,
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES ?? 20),
  retentionDays: Number(process.env.PAST_CONTEST_RETENTION_DAYS ?? 180),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
};
const startedAt = new Date();
let stopping = false;
let running = false;

async function heartbeat(extra: Record<string, unknown> = {}) {
  await db.workerHeartbeat.upsert({
    where: { id: `worker:${workerId}` },
    create: { id: `worker:${workerId}`, lastBeat: new Date(), startedAt, info: { workerId, ...extra } },
    update: { lastBeat: new Date(), info: { workerId, ...extra } },
  });
}

async function loop() {
  if (stopping) return;
  running = true;
  const t0 = Date.now();
  try {
    const result = await runTick(db, opts);
    const d = result.dispatch;
    if (result.sync || d.claimed || result.reconcile.created || result.reconcile.cancelled) {
      logger.info({ sync: result.sync, reconcile: result.reconcile, dispatch: d, ms: Date.now() - t0 }, "tick");
    }
    await heartbeat({ lastTickMs: Date.now() - t0, dispatch: d });
  } catch (err) {
    logger.error({ err }, "tick failed");
    await heartbeat({ lastError: err instanceof Error ? err.message : String(err) }).catch(() => undefined);
  } finally {
    running = false;
  }
  if (!stopping) setTimeout(loop, tickMs);
}

async function shutdown(signal: string) {
  logger.info({ signal }, "worker stopping");
  stopping = true;
  const deadline = Date.now() + 20_000;
  while (running && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  await db.workerHeartbeat.delete({ where: { id: `worker:${workerId}` } }).catch(() => undefined);
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ tickMs, ...opts }, "worker started");
void loop();
