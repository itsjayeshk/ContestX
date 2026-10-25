import type { PlatformId } from "@/types/contest";

/** Normalized contest shape every provider must produce. */
export interface NormalizedContest {
  platform: PlatformId;
  providerContestId: string;
  name: string;
  /** UTC start instant */
  startTime: Date;
  durationSeconds: number;
  url: string;
  division: string | null;
  kind: string | null;
  source: string;
}

export interface ProviderResult {
  contests: NormalizedContest[];
  /** Items the provider returned but we could not normalize. */
  skipped: number;
  attempts: number;
}

export interface ContestProvider {
  platform: PlatformId;
  source: string;
  fetchContests(now: Date): Promise<ProviderResult>;
}

/** Error that should not be retried (bad response shape, 4xx other than 429). */
export class PermanentProviderError extends Error {
  readonly permanent = true;
}

/** Deterministic fallback key used when a platform gives no stable ID. */
export function fallbackContestKey(name: string, start: Date): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug}@${start.toISOString().slice(0, 10)}`;
}
