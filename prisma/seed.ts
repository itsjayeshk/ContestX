/** Promote accounts listed in ADMIN_EMAILS to admin. Safe to run repeatedly. */
import "dotenv/config";
import { createPrisma } from "@/lib/db";

const db = createPrisma();
const emails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
if (emails.length === 0) {
  console.log("ADMIN_EMAILS is empty; nothing to do.");
} else {
  const r = await db.user.updateMany({ where: { email: { in: emails } }, data: { role: "ADMIN" } });
  console.log(`Admin role set on ${r.count} existing account(s). Others become admin when they register.`);
}
await db.$disconnect();
