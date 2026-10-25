import type { PlatformId } from "@/types/contest";

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  short: string;
  home: string;
  /** Identity color. Validated as a set for dark-surface contrast and colorblind separation (dataviz validator). */
  color: string;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  LEETCODE: { id: "LEETCODE", name: "LeetCode", short: "LC", home: "https://leetcode.com/contest/", color: "#C98220" },
  CODEFORCES: { id: "CODEFORCES", name: "Codeforces", short: "CF", home: "https://codeforces.com/contests", color: "#5B86E5" },
  CODECHEF: { id: "CODECHEF", name: "CodeChef", short: "CC", home: "https://www.codechef.com/contests", color: "#C46FA8" },
};

export function platformName(p: PlatformId): string {
  return PLATFORM_META[p].name;
}
