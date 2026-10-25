import type { PlatformId } from "@/types/contest";
import { codechefProvider } from "./codechef";
import { codeforcesProvider } from "./codeforces";
import { leetcodeProvider } from "./leetcode";
import type { ContestProvider } from "./types";

export function allProviders(pastDays?: number): Record<PlatformId, ContestProvider> {
  return {
    CODEFORCES: codeforcesProvider(undefined, pastDays),
    CODECHEF: codechefProvider(undefined, pastDays),
    LEETCODE: leetcodeProvider(),
  };
}

export type { ContestProvider, NormalizedContest } from "./types";
