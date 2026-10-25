import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireUser, route } from "@/lib/http";
import { preferencesSchema } from "@/lib/validation";
import { reconcileReminders, sanitizeOffsets } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

export const PUT = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, preferencesSchema);
  const data = { ...body, offsetsMinutes: sanitizeOffsets(body.offsetsMinutes) };
  await prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  const result = await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  const pending = await prisma.scheduledReminder.count({ where: { userId: user.id, status: "PENDING" } });
  return NextResponse.json({ ok: true, reconcile: result, pending });
});
