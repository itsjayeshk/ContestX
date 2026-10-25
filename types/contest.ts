// Client-safe contest types shared by server and UI.
export const PLATFORMS = ["LEETCODE", "CODEFORCES", "CODECHEF"] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export type ContestPhase = "upcoming" | "ongoing" | "ended";

/** Shape sent to the browser. Timestamps are ISO strings in UTC. */
export interface ContestDTO {
  id: string;
  platform: PlatformId;
  name: string;
  url: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  division: string | null;
  kind: string | null;
  cancelled: boolean;
  scheduleChangedAt: string | null;
  previousStartTime: string | null;
  isSample: boolean;
  lastFetchedAt: string;
  /** Present only for signed-in users. */
  bookmarked?: boolean;
  reminder?: ContestReminderState;
}

export interface ContestReminderState {
  /** Will the reminder engine notify this user about this contest? */
  active: boolean;
  reason: "on" | "excluded" | "disabled" | "platform-off" | "not-bookmarked" | "no-channels";
  offsetsMinutes: number[];
  overridden: boolean;
  pendingCount: number;
}

export interface ProviderFreshness {
  platform: PlatformId;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastStatus: "SUCCESS" | "PARTIAL" | "FAILED" | null;
  lastError: string | null;
  stale: boolean;
}

export const REMINDER_PRESETS = [
  { minutes: 1440, label: "24 hours before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 5, label: "5 minutes before" },
] as const;

export const ALLOWED_OFFSETS: readonly number[] = REMINDER_PRESETS.map((p) => p.minutes);
