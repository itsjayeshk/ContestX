"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ContestDTO, ProviderFreshness } from "@/types/contest";

interface ContestsState {
  contests: ContestDTO[];
  freshness: ProviderFreshness[];
  timezone: string;
  signedIn: boolean;
  refreshing: boolean;
  lastLoadedAt: number;
  error: string | null;
  refresh: () => Promise<void>;
  setBookmark: (id: string, bookmarked: boolean) => Promise<void>;
  setContestPref: (id: string, pref: { excluded?: boolean; offsetsOverride?: number[] | null }) => Promise<void>;
}

const Ctx = createContext<ContestsState | null>(null);
const POLL_MS = 5 * 60_000;

export function ContestsProvider({
  initialContests,
  initialFreshness,
  timezone,
  signedIn,
  children,
}: {
  initialContests: ContestDTO[];
  initialFreshness: ProviderFreshness[];
  timezone: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [contests, setContests] = useState(initialContests);
  const [freshness, setFreshness] = useState(initialFreshness);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(() => Date.now());
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setRefreshing(true);
    try {
      const data = await api<{ contests: ContestDTO[]; freshness: ProviderFreshness[] }>("/api/contests", { cache: "no-store" });
      setContests(data.contests);
      setFreshness(data.freshness);
      setError(null);
      setLastLoadedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh contests");
    } finally {
      inflight.current = false;
      setRefreshing(false);
    }
  }, []);

  // Refresh periodically while the tab is visible, and when it becomes visible again.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadedAt > POLL_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [refresh, lastLoadedAt]);

  const setBookmark = useCallback(
    async (id: string, bookmarked: boolean) => {
      if (!signedIn) {
        toast("Sign in to save contests", { description: "Saved contests and reminders are tied to your account.", action: { label: "Sign in", onClick: () => (window.location.href = "/login") } });
        return;
      }
      setContests((cs) => cs.map((c) => (c.id === id ? { ...c, bookmarked } : c)));
      try {
        await api("/api/bookmarks", { method: "POST", json: { contestId: id, bookmarked } });
        toast.success(bookmarked ? "Contest saved" : "Removed from saved");
        void refresh();
      } catch (e) {
        setContests((cs) => cs.map((c) => (c.id === id ? { ...c, bookmarked: !bookmarked } : c)));
        toast.error(e instanceof Error ? e.message : "Could not update saved contests");
      }
    },
    [signedIn, refresh],
  );

  const setContestPref = useCallback(
    async (id: string, pref: { excluded?: boolean; offsetsOverride?: number[] | null }) => {
      if (!signedIn) {
        toast("Sign in to get reminders", { action: { label: "Sign in", onClick: () => (window.location.href = "/login") } });
        return;
      }
      try {
        await api("/api/contest-preferences", { method: "PUT", json: { contestId: id, ...pref } });
        toast.success(pref.excluded === true ? "Reminders off for this contest" : pref.excluded === false ? "Reminders on for this contest" : "Reminder times updated");
        await refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update reminders");
      }
    },
    [signedIn, refresh],
  );

  const value = useMemo(
    () => ({ contests, freshness, timezone, signedIn, refreshing, lastLoadedAt, error, refresh, setBookmark, setContestPref }),
    [contests, freshness, timezone, signedIn, refreshing, lastLoadedAt, error, refresh, setBookmark, setContestPref],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContests(): ContestsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContests must be used inside ContestsProvider");
  return v;
}
