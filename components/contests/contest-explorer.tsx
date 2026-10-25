"use client";
import { LayoutGrid, List, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { Segmented } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { useNow } from "@/hooks/use-now";
import { DEFAULT_FILTERS, filterContests, type ContestFilters } from "@/lib/filter-contests";
import { PLATFORMS, type ContestPhase, type PlatformId } from "@/types/contest";
import { ContestCard, ContestRow } from "./contest-card";
import { ContestFiltersBar } from "./contest-filters";

const PAGE = 24;

function readFilters(sp: URLSearchParams): ContestFilters {
  const platforms = (sp.get("platform")?.split(",").filter((p): p is PlatformId => (PLATFORMS as readonly string[]).includes(p)) ?? []) as PlatformId[];
  const phases = (sp.get("status")?.split(",").filter((p): p is ContestPhase => ["upcoming", "ongoing", "ended"].includes(p)) ?? []) as ContestPhase[];
  return {
    platforms: platforms.length ? platforms : DEFAULT_FILTERS.platforms,
    phases: phases.length ? phases : DEFAULT_FILTERS.phases,
    range: (["any", "today", "7d", "30d"].includes(sp.get("range") ?? "") ? sp.get("range") : "any") as ContestFilters["range"],
    query: sp.get("q") ?? "",
    sort: (["soonest", "latest", "platform"].includes(sp.get("sort") ?? "") ? sp.get("sort") : "soonest") as ContestFilters["sort"],
    savedOnly: sp.get("saved") === "1",
  };
}

function writeFilters(f: ContestFilters, view: string) {
  const sp = new URLSearchParams();
  if (f.platforms.length !== PLATFORMS.length) sp.set("platform", f.platforms.join(","));
  if (f.phases.join() !== DEFAULT_FILTERS.phases.join()) sp.set("status", f.phases.join(","));
  if (f.range !== "any") sp.set("range", f.range);
  if (f.query) sp.set("q", f.query);
  if (f.sort !== "soonest") sp.set("sort", f.sort);
  if (f.savedOnly) sp.set("saved", "1");
  if (view !== "list") sp.set("view", view);
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function ContestExplorer({ initialParams }: { initialParams: Record<string, string> }) {
  const { contests, timezone, signedIn } = useContests();
  const now = useNow();
  const [filters, setFilters] = useState<ContestFilters>(() => readFilters(new URLSearchParams(initialParams)));
  const [view, setView] = useState<"list" | "grid">(initialParams.view === "grid" ? "grid" : "list");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => writeFilters(filters, view), [filters, view]);
  useEffect(() => setLimit(PAGE), [filters]);

  // Before hydration use the data's fetch time so server and client agree.
  const ref = now ?? new Date(contests[0]?.lastFetchedAt ?? 0);
  const results = useMemo(() => filterContests(contests, filters, ref, timezone), [contests, filters, ref.getTime() - (ref.getTime() % 60_000), timezone]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = results.slice(0, limit);

  return (
    <div className="flex flex-col gap-6">
      <ContestFiltersBar value={filters} onChange={setFilters} signedIn={signedIn} resultCount={results.length} />
      <div className="-mt-2 flex justify-end">
        <Segmented
          label="Layout"
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List", icon: <List /> },
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
          ]}
        />
      </div>

      {results.length === 0 ? (
        <EmptyState icon={<SearchX />} title={contests.length === 0 ? "No contests yet" : "Nothing matches these filters"}>
          {contests.length === 0 ? (
            "Schedules appear here once the background worker has fetched them from LeetCode, Codeforces and CodeChef."
          ) : (
            <div className="flex flex-col items-start gap-3">
              <span>Try a wider time range, another platform, or include past contests.</span>
              <Button size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset filters
              </Button>
            </div>
          )}
        </EmptyState>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <ContestCard key={c.id} contest={c} />
          ))}
        </div>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden" aria-label="Contests">
          {shown.map((c) => (
            <ContestRow key={c.id} contest={c} />
          ))}
        </ul>
      )}

      {results.length > limit && (
        <Button variant="secondary" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, results.length - limit)} more
        </Button>
      )}
    </div>
  );
}
