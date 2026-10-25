import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Database lease so only one worker runs a given job at a time, even across processes
 * and connection pools. Returns true if this owner now holds the lease.
 */
export async function acquireLease(db: PrismaClient, name: string, owner: string, ttlMs: number, now = new Date()): Promise<boolean> {
  const id = `lease:${name}`;
  const expiredBefore = new Date(now.getTime() - ttlMs);
  const rows = await db.$queryRaw<{ id: string }[]>`
    INSERT INTO "WorkerHeartbeat" ("id", "lastBeat", "startedAt", "info")
    VALUES (${id}, ${now}, ${now}, ${JSON.stringify({ owner })}::jsonb)
    ON CONFLICT ("id") DO UPDATE
      SET "lastBeat" = EXCLUDED."lastBeat", "startedAt" = EXCLUDED."startedAt", "info" = EXCLUDED."info"
      WHERE "WorkerHeartbeat"."lastBeat" < ${expiredBefore}
         OR "WorkerHeartbeat"."info"->>'owner' = ${owner}
    RETURNING "id"`;
  return rows.length > 0;
}

export async function releaseLease(db: PrismaClient, name: string, owner: string): Promise<void> {
  await db.$executeRaw`
    DELETE FROM "WorkerHeartbeat" WHERE "id" = ${`lease:${name}`} AND "info"->>'owner' = ${owner}`;
}
