import { z } from "zod";
import { fetchJsonWithRetry, type RetryOptions } from "./http";
import { PermanentProviderError, fallbackContestKey, type ContestProvider, type NormalizedContest, type ProviderResult } from "./types";

// CodeChef has no documented public API for schedules. This is the JSON endpoint that
// powers codechef.com/contests (public, unauthenticated). We call it once per sync
// interval with a descriptive User-Agent and never bypass any access control.
export const CODECHEF_URL =
  "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all";

const contestSchema = z.object({
  contest_code: z.string().min(1).optional(),
  contest_name: z.string().min(1),
  contest_start_date_iso: z.string().min(1),
  contest_end_date_iso: z.string().optional(),
  contest_duration: z.union([z.string(), z.number()]).optional(),
});

const responseSchema = z.object({
  status: z.string().optional(),
  present_contests: z.array(z.unknown()).optional(),
  future_contests: z.array(z.unknown()).optional(),
  past_contests: z.array(z.unknown()).optional(),
});

function divisionFromName(name: string): string | null {
  const m = name.match(/\(Div\.?\s*(\d)\)|Division\s*(\d)/i);
  if (m) return `Div. ${m[1] ?? m[2]}`;
  return null;
}

export function parseCodeChef(body: unknown, now: Date, pastDays = 180): { contests: NormalizedContest[]; skipped: number } {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PermanentProviderError("CodeChef: unexpected response shape");
  const d = parsed.data;
  if (d.status && d.status !== "success") throw new Error(`CodeChef API status ${d.status}`);
  if (!d.future_contests && !d.present_contests) {
    throw new PermanentProviderError("CodeChef: response has no contest lists");
  }
  const cutoff = now.getTime() - pastDays * 86_400_000;
  const all = [...(d.present_contests ?? []), ...(d.future_contests ?? []), ...(d.past_contests ?? [])];
  const seen = new Set<string>();
  const contests: NormalizedContest[] = [];
  let skipped = 0;

  for (const raw of all) {
    const c = contestSchema.safeParse(raw);
    if (!c.success) {
      skipped++;
      continue;
    }
    const start = new Date(c.data.contest_start_date_iso);
    if (Number.isNaN(start.getTime())) {
      skipped++;
      continue;
    }
    if (start.getTime() < cutoff) continue;

    let durationSeconds: number | null = null;
    if (c.data.contest_end_date_iso) {
      const end = new Date(c.data.contest_end_date_iso);
      if (!Number.isNaN(end.getTime()) && end > start) durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
    }
    if (durationSeconds === null && c.data.contest_duration !== undefined) {
      const minutes = Number(c.data.contest_duration);
      if (Number.isFinite(minutes) && minutes > 0) durationSeconds = Math.round(minutes * 60);
    }
    if (!durationSeconds) {
      skipped++;
      continue;
    }

    const id = c.data.contest_code ?? fallbackContestKey(c.data.contest_name, start);
    if (seen.has(id)) continue;
    seen.add(id);
    contests.push({
      platform: "CODECHEF",
      providerContestId: id,
      name: c.data.contest_name.trim(),
      startTime: start,
      durationSeconds,
      url: c.data.contest_code ? `https://www.codechef.com/${encodeURIComponent(c.data.contest_code)}` : "https://www.codechef.com/contests",
      division: divisionFromName(c.data.contest_name),
      kind: /starters/i.test(c.data.contest_name) ? "Starters" : null,
      source: "codechef-contest-list",
    });
  }
  return { contests, skipped };
}

export function codechefProvider(retry?: RetryOptions, pastDays?: number): ContestProvider {
  return {
    platform: "CODECHEF",
    source: "codechef-contest-list",
    async fetchContests(now: Date): Promise<ProviderResult> {
      const { body, attempts } = await fetchJsonWithRetry(CODECHEF_URL, {}, retry);
      return { ...parseCodeChef(body, now, pastDays), attempts };
    },
  };
}
