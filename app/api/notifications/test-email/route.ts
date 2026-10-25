import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, requireUser, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resendSender } from "@/lib/notify/email";
import { testMessage } from "@/lib/notify/templates";

export const POST = route(async () => {
  const user = await requireUser();
  if (!rateLimit(`test-email:${user.id}`, 3, 10 * 60_000).ok) throw new HttpError(429, "Wait a few minutes before sending another test email");
  const e = env();
  const message = testMessage("email", e.APP_URL);
  const res = await resendSender(e.RESEND_API_KEY, e.EMAIL_FROM)({
    reminderId: null, userId: user.id, email: user.email, message, idempotencyKey: `test-email-${user.id}-${Date.now()}`,
  });
  await prisma.notificationDelivery.create({
    data: { userId: user.id, channel: "EMAIL", status: res.ok ? "SUCCESS" : "FAILED", title: message.title, body: message.body, isTest: true, error: res.ok ? null : res.error, providerMessageId: res.ok ? res.providerMessageId : null },
  });
  if (!res.ok) throw new HttpError(res.transient ? 502 : 400, res.error);
  // Accepted by Resend; actual inbox delivery is tracked by Resend, not guaranteed here.
  return NextResponse.json({ ok: true, id: res.providerMessageId });
});
