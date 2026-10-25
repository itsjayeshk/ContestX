import "dotenv/config";
import pg from "pg";

/** Ensure there is at least one upcoming contest to interact with. It is a labelled sample row. */
export default async function globalSetup() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const start = new Date(Date.now() + 3 * 86_400_000);
  await client.query(
    `INSERT INTO "Contest" ("id","platform","providerContestId","name","url","startTime","durationSeconds","endTime","source","isSample","updatedAt")
     VALUES ('e2e-sample','CODEFORCES','sample-e2e-fixture','Sample E2E Fixture Round','https://codeforces.com/contests',$1,7200,$2,'sample-seed',true,now())
     ON CONFLICT ("platform","providerContestId") DO UPDATE SET "startTime"=$1,"endTime"=$2,"state"='SCHEDULED'`,
    [start, new Date(start.getTime() + 7200_000)],
  );
  await client.end();
}
