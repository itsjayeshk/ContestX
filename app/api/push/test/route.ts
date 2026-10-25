import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, requireUser, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { webPushSender } from "@/lib/notify/push";
import { testMessage } from "@/lib/notify/templates";

export const POST = route(async () => {
  const user = await requireUser();
  if (!rateLimit(`test-push:${user.id}`, 5, 10 * 60_000).ok) throw new HttpError(429, "Wait a few minutes before sending another test");
  const e = env();
  const message = testMessage("push", e.APP_URL);
  const res = await webPushSender(prisma, { publicKey: e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT })({
    reminderId: null, userId: user.id, email: user.email, message, idempotencyKey: `test-push-${Date.now()}`,
  });
  await prisma.notificationDelivery.create({
    data: { userId: user.id, channel: "PUSH", status: res.ok ? "SUCCESS" : "FAILED", title: message.title, body: message.body, isTest: true, error: res.ok ? null : res.error, providerMessageId: res.ok ? res.providerMessageId : null },
  });
  if (!res.ok) throw new HttpError(502, res.error);
  return NextResponse.json({ ok: true, detail: res.providerMessageId });
});
