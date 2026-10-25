"use client";
import { useSyncExternalStore } from "react";

// One shared 1-second clock for every countdown on the page.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time, ticking every second on the client. Null during SSR to avoid hydration mismatch. */
export function useNow(): Date | null {
  const t = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
  return t === null ? null : new Date(t);
}
