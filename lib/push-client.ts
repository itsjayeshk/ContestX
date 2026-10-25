"use client";
import { api } from "@/lib/api-client";

export type PushSupport = "unsupported" | "denied" | "default" | "granted";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushSupport;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === "unsupported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe this browser and register it with the server. */
export async function enablePush(vapidPublicKey: string): Promise<void> {
  if (pushSupport() === "unsupported") throw new Error("This browser doesn't support web push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again." : "Notification permission was not granted.");
  }
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  await api("/api/push/subscribe", { method: "POST", json: sub.toJSON() });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api("/api/push/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe();
}
