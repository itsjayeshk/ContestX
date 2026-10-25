import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireUser, route } from "@/lib/http";
import { accountSchema } from "@/lib/validation";

export const PUT = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, accountSchema);
  await prisma.user.update({ where: { id: user.id }, data: body });
  return NextResponse.json({ ok: true });
});
