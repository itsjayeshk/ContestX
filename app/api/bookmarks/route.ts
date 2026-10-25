import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, parseBody, requireUser, route } from "@/lib/http";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

const schema = z.object({ contestId: z.string().min(1).max(40), bookmarked: z.boolean() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { contestId, bookmarked } = await parseBody(req, schema);
  if (!(await prisma.contest.findUnique({ where: { id: contestId }, select: { id: true } }))) throw new HttpError(404, "Contest not found");
  if (bookmarked) {
    await prisma.contestBookmark.upsert({ where: { userId_contestId: { userId: user.id, contestId } }, create: { userId: user.id, contestId }, update: {} });
  } else {
    await prisma.contestBookmark.deleteMany({ where: { userId: user.id, contestId } });
  }
  await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  return NextResponse.json({ ok: true, bookmarked });
});
