import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { pushConfigured } from "@/lib/env";
import { HttpError, parseBody, requireUser, route } from "@/lib/http";
import { pushSubscriptionSchema } from "@/lib/validation";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

export const POST = route(async (req) => {
  const user = await requireUser();
  if (!pushConfigured()) throw new HttpError(503, "Push notifications are not configured on this server");
  const sub = await parseBody(req, pushSubscriptionSchema);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, failureCount: 0 },
  });
  await prisma.reminderPreference.update({ where: { userId: user.id }, data: { pushEnabled: true } });
  await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().url() }));
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  return NextResponse.json({ ok: true });
});
