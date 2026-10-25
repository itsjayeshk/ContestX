import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { HttpError, parseBody, route } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

// Constant-ish work for unknown emails so response time doesn't reveal which accounts exist.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);

export const POST = route(async (req) => {
  const body = await parseBody(req, loginSchema);
  const rl = rateLimit(`login:${clientIp(req)}:${body.email}`, 8, 15 * 60_000);
  if (!rl.ok) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.`);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect");
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
