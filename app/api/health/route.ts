import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadFreshness } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Liveness + readiness. 200 when the database is reachable; details describe the worker and providers. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
  const beat = await prisma.workerHeartbeat.findFirst({ where: { id: { startsWith: "worker:" } }, orderBy: { lastBeat: "desc" } });
  const workerAgeSec = beat ? Math.round((Date.now() - beat.lastBeat.getTime()) / 1000) : null;
  const freshness = await loadFreshness();
  const workerOk = workerAgeSec !== null && workerAgeSec < env().DISPATCH_INTERVAL_SECONDS * 4;
  return NextResponse.json({
    status: workerOk && freshness.every((f) => !f.stale) ? "ok" : "degraded",
    database: "ok",
    worker: { alive: workerOk, lastHeartbeatSecondsAgo: workerAgeSec },
    providers: freshness.map((f) => ({ platform: f.platform, stale: f.stale, lastSuccessAt: f.lastSuccessAt, lastStatus: f.lastStatus })),
    ms: Date.now() - started,
  });
}
