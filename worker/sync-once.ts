/** Run one provider sync now and print the result. Useful to verify live fetching. */
import "dotenv/config";
import { createPrisma } from "@/lib/db";
import { runSync } from "@/lib/jobs/tick";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { channelAvailability } from "@/lib/notify";

const db = createPrisma();
const outcomes = await runSync(db, { workerId: `cli:${process.pid}`, retentionDays: Number(process.env.PAST_CONTEST_RETENTION_DAYS ?? 180) });
for (const o of outcomes) {
  console.log(`${o.platform.padEnd(11)} ${o.status.padEnd(8)} fetched=${o.fetched} new=${o.created} updated=${o.updated} rescheduled=${o.rescheduled} cancelled=${o.cancelled}${o.error ? `  error: ${o.error}` : ""}`);
}
console.log("reminders:", await reconcileReminders(db, channelAvailability()));
await db.$disconnect();
