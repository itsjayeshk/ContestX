import webpush from "web-push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Sender } from "./types";

export interface VapidConfig {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}

/** Sends to every browser the user subscribed. Success if at least one accepts. */
export function webPushSender(db: PrismaClient, vapid: VapidConfig): Sender {
  return async ({ userId, message, reminderId }) => {
    if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) {
      return { ok: false, transient: false, error: "Push is not configured on this server (VAPID keys)" };
    }
    const subs = await db.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return { ok: false, transient: false, error: "No browser is subscribed to push for this account" };

    const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: reminderId ?? "test" });
    let delivered = 0;
    let transientFailure = false;
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 3600, urgency: "high", vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey } },
        );
        delivered++;
        await db.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser revoked this subscription; forget it.
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          errors.push("A browser subscription expired and was removed");
        } else {
          if (!status || status === 429 || status >= 500) transientFailure = true;
          await db.pushSubscription.update({ where: { id: sub.id }, data: { failureCount: { increment: 1 } } }).catch(() => undefined);
          errors.push(`Push service ${status ?? "network error"}`);
        }
      }
    }
    if (delivered > 0) return { ok: true, providerMessageId: `${delivered}/${subs.length} browsers` };
    return { ok: false, transient: transientFailure, error: errors.join("; ") || "Push failed" };
  };
}
