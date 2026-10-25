import { z } from "zod";
import { fetchJsonWithRetry, type RetryOptions } from "./http";
import { PermanentProviderError, type ContestProvider, type NormalizedContest, type ProviderResult } from "./types";

// LeetCode has no documented public API. Its website reads contest data from a public,
// unauthenticated GraphQL endpoint; we send one read-only query per sync interval.
export const LEETCODE_URL = "https://leetcode.com/graphql";
export const LEETCODE_QUERY = "query upcomingContests { upcomingContests { title titleSlug startTime duration } }";

const contestSchema = z.object({
  title: z.string().min(1),
  titleSlug: z.string().min(1),
  startTime: z.number().int(),
  duration: z.number().int().positive(),
});

const responseSchema = z.object({
  data: z.object({ upcomingContests: z.array(z.unknown()) }).nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export function parseLeetCode(body: unknown): { contests: NormalizedContest[]; skipped: number } {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PermanentProviderError("LeetCode: unexpected response shape");
  if (parsed.data.errors?.length) {
    throw new PermanentProviderError(`LeetCode GraphQL error: ${parsed.data.errors.map((e) => e.message).join("; ")}`);
  }
  const list = parsed.data.data?.upcomingContests;
  if (!list) throw new PermanentProviderError("LeetCode: response missing upcomingContests");
  const contests: NormalizedContest[] = [];
  let skipped = 0;
  for (const raw of list) {
    const c = contestSchema.safeParse(raw);
    if (!c.success) {
      skipped++;
      continue;
    }
    const kind = /biweekly/i.test(c.data.title) ? "Biweekly" : /weekly/i.test(c.data.title) ? "Weekly" : null;
    contests.push({
      platform: "LEETCODE",
      providerContestId: c.data.titleSlug,
      name: c.data.title.trim(),
      startTime: new Date(c.data.startTime * 1000),
      durationSeconds: c.data.duration,
      url: `https://leetcode.com/contest/${encodeURIComponent(c.data.titleSlug)}/`,
      division: null,
      kind,
      source: "leetcode-graphql",
    });
  }
  return { contests, skipped };
}

export function leetcodeProvider(retry?: RetryOptions): ContestProvider {
  return {
    platform: "LEETCODE",
    source: "leetcode-graphql",
    async fetchContests(): Promise<ProviderResult> {
      const { body, attempts } = await fetchJsonWithRetry(
        LEETCODE_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/contest/" },
          body: JSON.stringify({ query: LEETCODE_QUERY, operationName: "upcomingContests", variables: {} }),
        },
        retry,
      );
      return { ...parseLeetCode(body), attempts };
    },
  };
}
