import { beforeEach } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://contestx:contestx@localhost:5432/contestx_test";
process.env.LOG_LEVEL = "silent";

beforeEach(async () => {
  const { testDb } = await import("./db");
  await testDb.$executeRawUnsafe(
    `TRUNCATE "NotificationDelivery","ScheduledReminder","UserContestPreference","ContestBookmark","ReminderPreference","PushSubscription","Session","User","Contest","ProviderSyncLog","WorkerHeartbeat" CASCADE`,
  );
});
