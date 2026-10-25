-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('LEETCODE', 'CODEFORCES', 'CODECHEF');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContestState" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderScope" AS ENUM ('ALL_QUALIFYING', 'BOOKMARKED_ONLY');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "codeforcesHandle" TEXT,
    "leetcodeHandle" TEXT,
    "calendarToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "providerContestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "division" TEXT,
    "kind" TEXT,
    "state" "ContestState" NOT NULL DEFAULT 'SCHEDULED',
    "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
    "previousStartTime" TIMESTAMP(3),
    "scheduleChangedAt" TIMESTAMP(3),
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestBookmark" (
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestBookmark_pkey" PRIMARY KEY ("userId","contestId")
);

-- CreateTable
CREATE TABLE "ReminderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" "ReminderScope" NOT NULL DEFAULT 'ALL_QUALIFYING',
    "offsetsMinutes" INTEGER[] DEFAULT ARRAY[60, 15]::INTEGER[],
    "platforms" "Platform"[] DEFAULT ARRAY['LEETCODE', 'CODEFORCES', 'CODECHEF']::"Platform"[],
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContestPreference" (
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "hasOverride" BOOLEAN NOT NULL DEFAULT false,
    "offsetsOverride" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContestPreference_pkey" PRIMARY KEY ("userId","contestId")
);

-- CreateTable
CREATE TABLE "ScheduledReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "channel" "Channel" NOT NULL,
    "scheduleVersion" INTEGER NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSyncLog" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "rescheduledCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ProviderSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "lastBeat" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "info" JSONB,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Contest_startTime_idx" ON "Contest"("startTime");

-- CreateIndex
CREATE INDEX "Contest_platform_startTime_idx" ON "Contest"("platform", "startTime");

-- CreateIndex
CREATE INDEX "Contest_state_startTime_idx" ON "Contest"("state", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_platform_providerContestId_key" ON "Contest"("platform", "providerContestId");

-- CreateIndex
CREATE INDEX "ContestBookmark_contestId_idx" ON "ContestBookmark"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderPreference_userId_key" ON "ReminderPreference"("userId");

-- CreateIndex
CREATE INDEX "ScheduledReminder_status_fireAt_idx" ON "ScheduledReminder"("status", "fireAt");

-- CreateIndex
CREATE INDEX "ScheduledReminder_userId_status_fireAt_idx" ON "ScheduledReminder"("userId", "status", "fireAt");

-- CreateIndex
CREATE INDEX "ScheduledReminder_contestId_idx" ON "ScheduledReminder"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledReminder_dedupe_key" ON "ScheduledReminder"("userId", "contestId", "offsetMinutes", "channel", "scheduleVersion");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_reminderId_attempt_key" ON "NotificationDelivery"("reminderId", "attempt");

-- CreateIndex
CREATE INDEX "ProviderSyncLog_platform_startedAt_idx" ON "ProviderSyncLog"("platform", "startedAt");

-- CreateIndex
CREATE INDEX "ProviderSyncLog_status_startedAt_idx" ON "ProviderSyncLog"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestBookmark" ADD CONSTRAINT "ContestBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestBookmark" ADD CONSTRAINT "ContestBookmark_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderPreference" ADD CONSTRAINT "ReminderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContestPreference" ADD CONSTRAINT "UserContestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContestPreference" ADD CONSTRAINT "UserContestPreference_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "ScheduledReminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
