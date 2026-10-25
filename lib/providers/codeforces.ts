import { z } from "zod";
import { fetchJsonWithRetry, type RetryOptions } from "./http";
import { PermanentProviderError, type ContestProvider, type NormalizedContest, type ProviderResult } from "./types";

// Official, documented API: https://codeforces.com/apiHelp/methods#contest.list
// Codeforces asks clients to make at most one call every two seconds; we call once per sync.
export const CODEFORCES_URL = "https://codeforces.com/api/contest.list?gym=false";

const contestSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  type: z.string().optional(),
  phase: z.string(),
  durationSeconds: z.number().int().positive(),
  startTimeSeconds: z.number().int().optional(),
});

const responseSchema = z.object({
  status: z.string(),
  comment: z.string().optional(),
  result: z.array(z.unknown()).optional(),
});

export function parseDivision(name: string): string | null {
  const div = name.match(/Div\.\s*(\d)(?:\s*\+\s*(?:Div\.\s*)?(\d))?/i);
  if (div) return div[2] ? `Div. ${div[1]} + ${div[2]}` : `Div. ${div[1]}`;
  if (/educational/i.test(name)) return "Educational";
  if (/global round/i.test(name)) return "Global";
  return null;
}

export function parseCodeforces(body: unknown, now: Date, pastDays = 180): { contests: NormalizedContest[]; skipped: number } {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PermanentProviderError("Codeforces: unexpected response shape");
  if (parsed.data.status !== "OK" || !parsed.data.result) {
    throw new Error(`Codeforces API status ${parsed.data.status}: ${parsed.data.comment ?? "no comment"}`);
  }
  const cutoff = now.getTime() - pastDays * 86_400_000;
  const contests: NormalizedContest[] = [];
  let skipped = 0;
  for (const raw of parsed.data.result) {
    const c = contestSchema.safeParse(raw);
    if (!c.success || c.data.startTimeSeconds === undefined) {
      skipped++;
      continue;
    }
    const start = new Date(c.data.startTimeSeconds * 1000);
    if (start.getTime() < cutoff) continue;
    contests.push({
      platform: "CODEFORCES",
      providerContestId: String(c.data.id),
      name: c.data.name.trim(),
      startTime: start,
      durationSeconds: c.data.durationSeconds,
      url: `https://codeforces.com/contests/${c.data.id}`,
      division: parseDivision(c.data.name),
      kind: c.data.type ?? null,
      source: "codeforces-api",
    });
  }
  return { contests, skipped };
}

export function codeforcesProvider(retry?: RetryOptions, pastDays?: number): ContestProvider {
  return {
    platform: "CODEFORCES",
    source: "codeforces-api",
    async fetchContests(now: Date): Promise<ProviderResult> {
      const { body, attempts } = await fetchJsonWithRetry(CODEFORCES_URL, {}, retry);
      return { ...parseCodeforces(body, now, pastDays), attempts };
    },
  };
}
