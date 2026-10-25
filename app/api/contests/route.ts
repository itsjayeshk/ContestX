import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { loadContests, loadFreshness } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getCurrentUser();
  const [contests, freshness] = await Promise.all([loadContests(user), loadFreshness()]);
  return NextResponse.json({ contests, freshness, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
});
