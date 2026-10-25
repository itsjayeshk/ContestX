import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const POST = route(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
