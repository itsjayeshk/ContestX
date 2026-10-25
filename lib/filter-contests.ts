import { contestPhase, dayKey } from "@/lib/time";
import { PLATFORMS, type ContestDTO, type ContestPhase, type PlatformId } from "@/types/contest";

export type RangeFilter = "any" | "today" | "7d" | "30d";
export type SortKey = "soonest" | "latest" | "platform";

export interface ContestFilters {
  platforms: PlatformId[];
  phases: ContestPhase[];
  range: RangeFilter;
  query: string;
  sort: SortKey;
  savedOnly?: boolean;
}

export const DEFAULT_FILTERS: ContestFilters = { platforms: [...PLATFORMS], phases: ["upcoming", "ongoing"], range: "any", query: "", sort: "soonest" };

export function filterContests(list: ContestDTO[], f: ContestFilters, now: Date, tz: string): ContestDTO[] {
  const q = f.query.trim().toLowerCase();
  const today = dayKey(now, tz);
  const horizon = f.range === "7d" ? 7 : f.range === "30d" ? 30 : null;
  const out = list.filter((c) => {
    if (!f.platforms.includes(c.platform)) return false;
    if (f.savedOnly && !c.bookmarked) return false;
    const phase = contestPhase(c.startTime, c.endTime, now);
    if (!f.phases.includes(phase)) return false;
    if (q && !`${c.name} ${c.division ?? ""} ${c.kind ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.range === "today") {
      // Contests that start today, or are running today, in the viewer's timezone.
      if (dayKey(c.startTime, tz) !== today && phase !== "ongoing") return false;
    } else if (horizon !== null) {
      const start = new Date(c.startTime).getTime();
      if (phase !== "ongoing" && (start < now.getTime() || start > now.getTime() + horizon * 86_400_000)) return false;
    }
    return true;
  });
  const byStart = (a: ContestDTO, b: ContestDTO) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  if (f.sort === "soonest") out.sort(byStart);
  else if (f.sort === "latest") out.sort((a, b) => byStart(b, a));
  else out.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform) || byStart(a, b));
  return out;
}

/** The next contest that hasn't started yet and isn't cancelled. */
export function nextContest(list: ContestDTO[], now: Date, platforms?: PlatformId[]): ContestDTO | null {
  return (
    list
      .filter((c) => !c.cancelled && new Date(c.startTime).getTime() > now.getTime() && (!platforms || platforms.includes(c.platform)))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null
  );
}

/** The contest to feature: one that is live right now (ending soonest), otherwise the next to start. */
export function pickFeatured(list: ContestDTO[], now: Date): ContestDTO | null {
  const live = list
    .filter((c) => !c.cancelled && contestPhase(c.startTime, c.endTime, now) === "ongoing")
    .sort((a, b) => +new Date(a.endTime) - +new Date(b.endTime));
  return live[0] ?? nextContest(list, now);
}
