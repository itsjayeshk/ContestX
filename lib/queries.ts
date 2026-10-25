import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { providerFreshness } from "@/lib/freshness";
import { sanitizeOffsets } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";
import type { ContestDTO, ContestReminderState, ProviderFreshness } from "@/types/contest";
import type { SessionUser } from "@/lib/auth/session";
import type { Contest } from "@/generated/prisma/client";

/** Upcoming and ongoing contests, plus finished ones from the last `pastDays`. */
export async function loadContests(user: SessionUser | null, opts: { pastDays?: number } = {}): Promise<ContestDTO[]> {
  const now = new Date();
  const pastFrom = new Date(now.getTime() - (opts.pastDays ?? 30) * 86_400_000);
  const contests = await prisma.contest.findMany({
    where: { endTime: { gte: pastFrom } },
    orderBy: { startTime: "asc" },
  });
  if (!user) return contests.map((c) => toDTO(c));

  const ids = contests.map((c) => c.id);
  const [pref, bookmarks, cprefs, pending, pushCount] = await Promise.all([
    prisma.reminderPreference.findUnique({ where: { userId: user.id } }),
    prisma.contestBookmark.findMany({ where: { userId: user.id, contestId: { in: ids } }, select: { contestId: true } }),
    prisma.userContestPreference.findMany({ where: { userId: user.id, contestId: { in: ids } } }),
    prisma.scheduledReminder.groupBy({ by: ["contestId"], where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } }, _count: true }),
    prisma.pushSubscription.count({ where: { userId: user.id } }),
  ]);
  const bm = new Set(bookmarks.map((b) => b.contestId));
  const cp = new Map(cprefs.map((p) => [p.contestId, p]));
  const pend = new Map(pending.map((p) => [p.contestId, p._count]));
  const avail = channelAvailability();
  const hasChannel = !!pref && (pref.inAppEnabled || (pref.emailEnabled && avail.email) || (pref.pushEnabled && avail.push && pushCount > 0));

  return contests.map((c) => {
    const p = cp.get(c.id);
    const offsets = sanitizeOffsets(p?.hasOverride ? p.offsetsOverride : (pref?.offsetsMinutes ?? []));
    let reason: ContestReminderState["reason"] = "on";
    if (!pref || !pref.enabled) reason = "disabled";
    else if (!hasChannel) reason = "no-channels";
    else if (!pref.platforms.includes(c.platform)) reason = "platform-off";
    else if (p?.excluded) reason = "excluded";
    else if (pref.scope === "BOOKMARKED_ONLY" && !bm.has(c.id) && !p?.hasOverride) reason = "not-bookmarked";
    return toDTO(c, {
      bookmarked: bm.has(c.id),
      reminder: { active: reason === "on", reason, offsetsMinutes: offsets, overridden: !!p?.hasOverride, pendingCount: pend.get(c.id) ?? 0 },
    });
  });
}

export function toDTO(c: Contest, extra: Partial<ContestDTO> = {}): ContestDTO {
  return {
    id: c.id,
    platform: c.platform,
    name: c.name,
    url: c.url,
    startTime: c.startTime.toISOString(),
    endTime: c.endTime.toISOString(),
    durationSeconds: c.durationSeconds,
    division: c.division,
    kind: c.kind,
    cancelled: c.state === "CANCELLED",
    scheduleChangedAt: c.scheduleChangedAt?.toISOString() ?? null,
    previousStartTime: c.previousStartTime?.toISOString() ?? null,
    isSample: c.isSample,
    lastFetchedAt: c.lastFetchedAt.toISOString(),
    ...extra,
  };
}

export async function loadFreshness(): Promise<ProviderFreshness[]> {
  return providerFreshness(prisma, env().SYNC_INTERVAL_MINUTES);
}

export async function userTimezone(user: SessionUser | null): Promise<string> {
  return user?.timezone ?? "Asia/Kolkata";
}
