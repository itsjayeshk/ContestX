import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, parseBody, requireUser, route } from "@/lib/http";
import { contestPrefSchema } from "@/lib/validation";
import { reconcileReminders, sanitizeOffsets } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

const schema = contestPrefSchema.extend({ contestId: z.string().min(1).max(40) });

/** Per-contest override: exclude a contest, or use custom reminder times (null = use defaults). */
export const PUT = route(async (req) => {
  const user = await requireUser();
  const { contestId, excluded, offsetsOverride } = await parseBody(req, schema);
  if (!(await prisma.contest.findUnique({ where: { id: contestId }, select: { id: true } }))) throw new HttpError(404, "Contest not found");
  const data: { excluded?: boolean; hasOverride?: boolean; offsetsOverride?: number[] } = {};
  if (excluded !== undefined) data.excluded = excluded;
  if (offsetsOverride !== undefined) {
    data.hasOverride = offsetsOverride !== null;
    data.offsetsOverride = offsetsOverride ? sanitizeOffsets(offsetsOverride) : [];
  }
  await prisma.userContestPreference.upsert({
    where: { userId_contestId: { userId: user.id, contestId } },
    create: { userId: user.id, contestId, ...data },
    update: data,
  });
  await reconcileReminders(prisma, channelAvailability(), { userIds: [user.id] });
  const pending = await prisma.scheduledReminder.count({ where: { userId: user.id, contestId, status: "PENDING" } });
  return NextResponse.json({ ok: true, pending });
});
