import { prisma } from "@/lib/db";
import { buildIcs } from "@/lib/ics";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await prisma.contest.findUnique({ where: { id } });
  if (!c) return new Response("Not found", { status: 404 });
  const ics = buildIcs([
    { uid: `${c.platform.toLowerCase()}-${c.providerContestId}`, name: c.name, platform: c.platform, start: c.startTime, end: c.endTime, url: c.url, cancelled: c.state === "CANCELLED", sequence: c.scheduleVersion, alarmsMinutes: [15] },
  ]);
  const file = c.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "contest";
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.ics"` } });
}
