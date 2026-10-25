import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export async function workerStatus() {
  const beat = await prisma.workerHeartbeat.findFirst({ where: { id: { startsWith: "worker:" } }, orderBy: { lastBeat: "desc" } });
  const ageSec = beat ? Math.round((Date.now() - beat.lastBeat.getTime()) / 1000) : null;
  return { alive: ageSec !== null && ageSec < env().DISPATCH_INTERVAL_SECONDS * 4, lastBeat: beat?.lastBeat.toISOString() ?? null, ageSec };
}
