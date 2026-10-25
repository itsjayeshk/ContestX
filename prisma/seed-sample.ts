/**
 * DEVELOPMENT ONLY. Inserts clearly labelled sample contests (isSample = true) so the UI
 * can be explored before the worker has reached the real platforms. Every sample row is
 * shown with a "Sample data" badge, is excluded from calendar feeds, and is removed with
 * `npm run db:seed:sample -- --remove`. Refuses to run when NODE_ENV=production.
 */
import "dotenv/config";
import { createPrisma } from "@/lib/db";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to insert sample contests in production.");
  process.exit(1);
}

const db = createPrisma();

if (process.argv.includes("--remove")) {
  const r = await db.contest.deleteMany({ where: { isSample: true } });
  console.log(`Removed ${r.count} sample contest(s).`);
  await db.$disconnect();
  process.exit(0);
}

const now = Date.now();
const h = 3600_000;
const at = (hoursFromNow: number) => new Date(Math.round((now + hoursFromNow * h) / (15 * 60_000)) * 15 * 60_000);

const samples = [
  { platform: "CODEFORCES", id: "sample-cf-1", name: "Sample Codeforces Round (Div. 2)", start: at(-1), dur: 7200, division: "Div. 2" },
  { platform: "LEETCODE", id: "sample-lc-1", name: "Sample Weekly Contest", start: at(5), dur: 5400, kind: "Weekly" },
  { platform: "CODECHEF", id: "sample-cc-1", name: "Sample Starters", start: at(30), dur: 7200, kind: "Starters" },
  { platform: "CODEFORCES", id: "sample-cf-2", name: "Sample Educational Round", start: at(52), dur: 7200, division: "Educational" },
  { platform: "LEETCODE", id: "sample-lc-2", name: "Sample Biweekly Contest", start: at(98), dur: 5400, kind: "Biweekly" },
  { platform: "CODECHEF", id: "sample-cc-2", name: "Sample Starters (Div. 2)", start: at(198), dur: 7200, division: "Div. 2" },
  { platform: "CODEFORCES", id: "sample-cf-3", name: "Sample Global Round", start: at(270), dur: 10800, division: "Global" },
  { platform: "CODEFORCES", id: "sample-cf-0", name: "Sample Codeforces Round (Div. 3)", start: at(-60), dur: 8100, division: "Div. 3" },
] as const;

for (const s of samples) {
  const data = {
    name: s.name,
    url: s.platform === "LEETCODE" ? "https://leetcode.com/contest/" : s.platform === "CODECHEF" ? "https://www.codechef.com/contests" : "https://codeforces.com/contests",
    startTime: s.start,
    durationSeconds: s.dur,
    endTime: new Date(s.start.getTime() + s.dur * 1000),
    division: "division" in s ? s.division : null,
    kind: "kind" in s ? s.kind : null,
    source: "sample-seed",
    isSample: true,
  };
  await db.contest.upsert({
    where: { platform_providerContestId: { platform: s.platform, providerContestId: s.id } },
    create: { platform: s.platform, providerContestId: s.id, ...data },
    update: data,
  });
}
console.log(`Inserted ${samples.length} SAMPLE contests (labelled in the UI). Remove with: npm run db:seed:sample -- --remove`);
await db.$disconnect();
