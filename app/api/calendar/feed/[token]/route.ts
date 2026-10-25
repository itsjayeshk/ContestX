import { prisma } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { sanitizeOffsets } from "@/lib/reminders/reconcile";

export const dynamic = "force-dynamic";

/**
 * Private, read-only iCal feed. Subscribe to it from Google Calendar ("From URL"),
 * Apple Calendar or Outlook. The token in the URL is the only credential, so it can
 * be rotated from settings.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token.replace(/\.ics$/, ""))) return new Response("Not found", { status: 404 });
  const user = await prisma.user.findUnique({
    where: { calendarToken: token.replace(/\.ics$/, "") },
    include: { reminderPreference: true },
  });
  if (!user) return new Response("Not found", { status: 404 });
  const pref = user.reminderPreference;
  const now = new Date();
  const [contests, bookmarks, cprefs] = await Promise.all([
    prisma.contest.findMany({
      where: { endTime: { gte: new Date(now.getTime() - 7 * 86_400_000) }, platform: { in: pref?.platforms ?? undefined } },
      orderBy: { startTime: "asc" },
    }),
    prisma.contestBookmark.findMany({ where: { userId: user.id }, select: { contestId: true } }),
    prisma.userContestPreference.findMany({ where: { userId: user.id } }),
  ]);
  const bm = new Set(bookmarks.map((b) => b.contestId));
  const cp = new Map(cprefs.map((p) => [p.contestId, p]));
  const events = contests
    .filter((c) => !c.isSample && !cp.get(c.id)?.excluded && (pref?.scope !== "BOOKMARKED_ONLY" || bm.has(c.id)))
    .map((c) => ({
      uid: `${c.platform.toLowerCase()}-${c.providerContestId}`,
      name: c.name,
      platform: c.platform,
      start: c.startTime,
      end: c.endTime,
      url: c.url,
      cancelled: c.state === "CANCELLED",
      sequence: c.scheduleVersion,
      alarmsMinutes: sanitizeOffsets(cp.get(c.id)?.hasOverride ? cp.get(c.id)!.offsetsOverride : (pref?.offsetsMinutes ?? [])),
    }));
  return new Response(buildIcs(events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=600", "Content-Disposition": 'inline; filename="contestx.ics"' },
  });
}
