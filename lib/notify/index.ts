import type { Channel, PrismaClient } from "@/generated/prisma/client";
import { resendSender } from "./email";
import { webPushSender } from "./push";
import type { Sender } from "./types";

/** In-app reminders are the NotificationDelivery row itself, which the dispatcher writes. */
export const inAppSender: Sender = async () => ({ ok: true, providerMessageId: "in-app" });

export function buildSenders(db: PrismaClient, e: NodeJS.ProcessEnv = process.env): Record<Channel, Sender> {
  return {
    EMAIL: resendSender(e.RESEND_API_KEY || undefined, e.EMAIL_FROM || undefined),
    PUSH: webPushSender(db, { publicKey: e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined, privateKey: e.VAPID_PRIVATE_KEY || undefined, subject: e.VAPID_SUBJECT || undefined }),
    IN_APP: inAppSender,
  };
}

export function channelAvailability(e: NodeJS.ProcessEnv = process.env) {
  return {
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
    push: Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT),
  };
}
