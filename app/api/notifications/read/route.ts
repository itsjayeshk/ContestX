import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/http";

export const POST = route(async () => {
  const user = await requireUser();
  await prisma.notificationDelivery.updateMany({ where: { userId: user.id, channel: "IN_APP", readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});
