import "server-only";
import { z } from "zod";
import { userAgent } from "@/lib/providers/http";
import type { PlatformId } from "@/types/contest";

export interface Participation {
  platform: PlatformId;
  contestName: string;
  date: string; // ISO
  rank: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
}

export interface ActivitySource {
  platform: PlatformId;
  handle: string;
  ok: boolean;
  error?: string;
}

export interface ParticipationData {
  participations: Participation[];
  /** Codeforces submission timestamps (ISO), used for weekly activity. */
  submissions: string[];
  sources: ActivitySource[];
}

const REVALIDATE = 3600;

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": userAgent(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: REVALIDATE },
  } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const cfRating = z.object({
  status: z.string(),
  comment: z.string().optional(),
  result: z.array(z.object({ contestName: z.string(), rank: z.number(), ratingUpdateTimeSeconds: z.number(), oldRating: z.number(), newRating: z.number() })).optional(),
});
const cfStatus = z.object({ status: z.string(), result: z.array(z.object({ creationTimeSeconds: z.number() })).optional() });

async function codeforces(handle: string): Promise<{ parts: Participation[]; subs: string[] }> {
  const h = encodeURIComponent(handle);
  const rating = cfRating.parse(await getJson(`https://codeforces.com/api/user.rating?handle=${h}`));
  if (rating.status !== "OK") throw new Error(rating.comment ?? "Codeforces rejected the handle");
  // Codeforces asks for at most one request every two seconds.
  await new Promise((r) => setTimeout(r, 2100));
  const status = cfStatus.safeParse(await getJson(`https://codeforces.com/api/user.status?handle=${h}&from=1&count=1000`).catch(() => null));
  return {
    parts: (rating.result ?? []).map((r) => ({
      platform: "CODEFORCES",
      contestName: r.contestName,
      date: new Date(r.ratingUpdateTimeSeconds * 1000).toISOString(),
      rank: r.rank,
      ratingAfter: r.newRating,
      ratingChange: r.newRating - r.oldRating,
    })),
    subs: status.success ? (status.data.result ?? []).map((s) => new Date(s.creationTimeSeconds * 1000).toISOString()) : [],
  };
}

const lcHistory = z.object({
  data: z
    .object({
      userContestRankingHistory: z
        .array(z.object({ attended: z.boolean(), rating: z.number(), ranking: z.number(), contest: z.object({ title: z.string(), startTime: z.number() }) }))
        .nullable(),
    })
    .nullable(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

async function leetcode(handle: string): Promise<Participation[]> {
  const body = lcHistory.parse(
    await getJson("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/" },
      body: JSON.stringify({
        query: "query h($username: String!) { userContestRankingHistory(username: $username) { attended rating ranking contest { title startTime } } }",
        variables: { username: handle },
      }),
    }),
  );
  if (body.errors?.length) throw new Error(body.errors[0].message);
  const rows = (body.data?.userContestRankingHistory ?? []).filter((r) => r.attended);
  let prev: number | null = null;
  return rows.map((r) => {
    const change: number | null = prev === null ? null : Math.round(r.rating - prev);
    prev = r.rating;
    return { platform: "LEETCODE" as const, contestName: r.contest.title, date: new Date(r.contest.startTime * 1000).toISOString(), rank: r.ranking, ratingAfter: Math.round(r.rating), ratingChange: change };
  });
}

/** Real participation history from the platforms, for the handles a user linked. */
export async function loadParticipation(handles: { codeforces?: string | null; leetcode?: string | null }): Promise<ParticipationData> {
  const out: ParticipationData = { participations: [], submissions: [], sources: [] };
  const tasks: Promise<void>[] = [];
  if (handles.codeforces) {
    const handle = handles.codeforces;
    tasks.push(
      codeforces(handle)
        .then(({ parts, subs }) => {
          out.participations.push(...parts);
          out.submissions.push(...subs);
          out.sources.push({ platform: "CODEFORCES", handle, ok: true });
        })
        .catch((e) => void out.sources.push({ platform: "CODEFORCES", handle, ok: false, error: e instanceof Error ? e.message : String(e) })),
    );
  }
  if (handles.leetcode) {
    const handle = handles.leetcode;
    tasks.push(
      leetcode(handle)
        .then((parts) => {
          out.participations.push(...parts);
          out.sources.push({ platform: "LEETCODE", handle, ok: true });
        })
        .catch((e) => void out.sources.push({ platform: "LEETCODE", handle, ok: false, error: e instanceof Error ? e.message : String(e) })),
    );
  }
  await Promise.all(tasks);
  out.participations.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
