import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdmin, route } from "@/lib/http";
import { runSync } from "@/lib/jobs/tick";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

export const maxDuration = 60;

export const POST = route(async () => {
  const admin = await requireAdmin();
  const outcomes = await runSync(prisma, { workerId: `admin:${admin.id}`, retentionDays: env().PAST_CONTEST_RETENTION_DAYS });
  const reconcile = await reconcileReminders(prisma, channelAvailability());
  return NextResponse.json({ outcomes, reconcile });
});
