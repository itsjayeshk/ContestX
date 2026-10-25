import { createPrisma } from "@/lib/db";
import type { PlatformId } from "@/types/contest";
import type { ContestProvider, NormalizedContest } from "@/lib/providers/types";

export const testDb = createPrisma(process.env.TEST_DATABASE_URL ?? "postgresql://contestx:contestx@localhost:5432/contestx_test");

export function fakeProvider(platform: PlatformId, impl: () => NormalizedContest[] | Error): ContestProvider {
  return {
    platform,
    source: "test",
    async fetchContests() {
      const r = impl();
      if (r instanceof Error) throw Object.assign(r, { attempts: 4 });
      return { contests: r, skipped: 0, attempts: 1 };
    },
  };
}

export function nc(id: string, start: string, durationSeconds = 7200, platform: PlatformId = "CODEFORCES"): NormalizedContest {
  return {
    platform,
    providerContestId: id,
    name: `Round ${id}`,
    startTime: new Date(start),
    durationSeconds,
    url: `https://example.test/${id}`,
    division: null,
    kind: null,
    source: "test",
  };
}

export async function makeUser(email = "u@test.dev", pref: Record<string, unknown> = {}) {
  return testDb.user.create({
    data: {
      email,
      passwordHash: "x",
      calendarToken: `tok-${email}`,
      reminderPreference: { create: { offsetsMinutes: [60, 15], emailEnabled: true, pushEnabled: false, inAppEnabled: true, ...pref } },
    },
  });
}
