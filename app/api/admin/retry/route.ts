import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, requireAdmin, route } from "@/lib/http";

/** Requeue failed reminders whose contest hasn't started. The dispatcher's checks still apply. */
export const POST = route(async (req) => {
  await requireAdmin();
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string().max(40)).min(1).max(200) }));
  const now = new Date();
  const r = await prisma.scheduledReminder.updateMany({
    where: { id: { in: ids }, status: "FAILED", contest: { startTime: { gt: now }, state: "SCHEDULED" } },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: null, lastError: null },
  });
  return NextResponse.json({ ok: true, requeued: r.count });
});
