import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { parseBody, route } from "@/lib/http";
import { isValidTimezone } from "@/lib/time";

const schema = z.object({ timezone: z.string().refine(isValidTimezone, "Unknown timezone") });

/** Works for guests too: their choice is kept in a cookie. */
export const POST = route(async (req) => {
  const { timezone } = await parseBody(req, schema);
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  (await cookies()).set("cx_tz", timezone, { path: "/", sameSite: "lax", maxAge: 365 * 86400 });
  return NextResponse.json({ ok: true, timezone });
});
