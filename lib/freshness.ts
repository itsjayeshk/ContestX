import type { PrismaClient } from "@/generated/prisma/client";
import { PLATFORMS, type PlatformId, type ProviderFreshness } from "@/types/contest";

/** Data is stale when the last good sync is older than this many sync intervals. */
const STALE_INTERVALS = 3;

export async function providerFreshness(db: PrismaClient, intervalMinutes: number, now = new Date()): Promise<ProviderFreshness[]> {
  const staleAfterMs = Math.max(STALE_INTERVALS * intervalMinutes, 60) * 60_000;
  return Promise.all(
    PLATFORMS.map(async (platform: PlatformId) => {
      const [lastAttempt, lastSuccess] = await Promise.all([
        db.providerSyncLog.findFirst({ where: { platform }, orderBy: { startedAt: "desc" } }),
        db.providerSyncLog.findFirst({ where: { platform, status: { in: ["SUCCESS", "PARTIAL"] } }, orderBy: { startedAt: "desc" } }),
      ]);
      const lastSuccessAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;
      return {
        platform,
        lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
        lastAttemptAt: lastAttempt?.startedAt.toISOString() ?? null,
        lastStatus: lastAttempt?.status ?? null,
        lastError: lastAttempt?.error ?? null,
        stale: !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() > staleAfterMs,
      };
    }),
  );
}
