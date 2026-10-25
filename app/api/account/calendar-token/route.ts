import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser, route } from "@/lib/http";

/** Replace the calendar feed token; the old feed URL stops working immediately. */
export const POST = route(async () => {
  const user = await requireUser();
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: user.id }, data: { calendarToken: token } });
  return NextResponse.json({ ok: true, url: `${env().APP_URL.replace(/\/$/, "")}/api/calendar/feed/${token}.ics` });
});
