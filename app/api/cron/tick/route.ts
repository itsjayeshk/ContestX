import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { runTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Alternative to the long-running worker for hosts without background processes:
 * call this every minute from an external scheduler with `Authorization: Bearer $CRON_SECRET`.
 * It is safe to call concurrently with the worker.
 */
export async function POST(req: Request) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const e = env();
  const result = await runTick(prisma, { workerId: `cron:${Date.now()}`, syncIntervalMinutes: e.SYNC_INTERVAL_MINUTES, retentionDays: e.PAST_CONTEST_RETENTION_DAYS, appUrl: e.APP_URL });
  return NextResponse.json(result);
}
