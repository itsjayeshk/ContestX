import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { HttpError, parseBody, route } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { createUser } from "@/lib/users";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

export const POST = route(async (req) => {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60_000);
  if (!rl.ok) throw new HttpError(429, `Too many sign-ups from this network. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.`);
  const body = await parseBody(req, registerSchema);
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw new HttpError(409, "An account with this email already exists. Sign in instead.");
  }
  const user = await createUser(body);
  await createSession(user.id);
  await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  return NextResponse.json({ ok: true });
});
