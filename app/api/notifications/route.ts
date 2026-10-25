import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Recent in-app notifications for the bell menu. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [], unread: 0, signedIn: false });
  const [items, unread] = await Promise.all([
    prisma.notificationDelivery.findMany({
      where: { userId: user.id, channel: "IN_APP", status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, body: true, url: true, createdAt: true, readAt: true },
    }),
    prisma.notificationDelivery.count({ where: { userId: user.id, channel: "IN_APP", status: "SUCCESS", readAt: null } }),
  ]);
  return NextResponse.json({ items, unread, signedIn: true });
});
