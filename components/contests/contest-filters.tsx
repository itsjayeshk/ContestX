"use client";
import { Search, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/field";
import { PLATFORM_META } from "@/lib/platforms";
import type { ContestFilters, RangeFilter, SortKey } from "@/lib/filter-contests";
import { PLATFORMS, type ContestPhase, type PlatformId } from "@/types/contest";
import { PlatformDot } from "./platform-mark";

const PHASES: { id: ContestPhase; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "ongoing", label: "Live" },
  { id: "ended", label: "Past" },
];
const RANGES: { id: RangeFilter; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Next 7 days" },
  { id: "30d", label: "Next 30 days" },
];

export function ContestFiltersBar({
  value,
  onChange,
  signedIn,
  resultCount,
}: {
  value: ContestFilters;
  onChange: (f: ContestFilters) => void;
  signedIn: boolean;
  resultCount: number;
}) {
  const set = (patch: Partial<ContestFilters>) => onChange({ ...value, ...patch });
  const allPlatforms = value.platforms.length === PLATFORMS.length;
  const togglePlatform = (p: PlatformId) => {
    if (allPlatforms) return set({ platforms: [p] });
    const next = value.platforms.includes(p) ? value.platforms.filter((x) => x !== p) : [...value.platforms, p];
    set({ platforms: next.length ? next : [...PLATFORMS] });
  };
  const togglePhase = (p: ContestPhase) => {
    const next = value.phases.includes(p) ? value.phases.filter((x) => x !== p) : [...value.phases, p];
    set({ phases: next.length ? next : [p] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" aria-hidden />
          <input
            type="search"
            value={value.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search contests, e.g. Div. 2, Starters, Weekly"
            aria-label="Search contests by name"
            className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-white/[0.03] pl-9 pr-9 text-sm text-ink placeholder:text-fog-2 hover:border-white/20 focus:border-violet/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {value.query && (
            <button type="button" onClick={() => set({ query: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fog hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <Select aria-label="Time range" value={value.range} onChange={(e) => set({ range: e.target.value as RangeFilter })} className="w-auto min-w-36">
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort contests" value={value.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} className="w-auto min-w-36">
            <option value="soonest">Soonest first</option>
            <option value="latest">Latest first</option>
            <option value="platform">By platform</option>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Platforms" className="flex flex-wrap gap-2">
          <Chip active={allPlatforms} onClick={() => set({ platforms: [...PLATFORMS] })}>
            All platforms
          </Chip>
          {PLATFORMS.map((p) => (
            <Chip key={p} active={!allPlatforms && value.platforms.includes(p)} onClick={() => togglePlatform(p)}>
              <PlatformDot platform={p} />
              {PLATFORM_META[p].name}
            </Chip>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <Chip key={p.id} active={value.phases.includes(p.id)} onClick={() => togglePhase(p.id)}>
              {p.label}
            </Chip>
          ))}
          {signedIn && (
            <Chip active={!!value.savedOnly} onClick={() => set({ savedOnly: !value.savedOnly })}>
              Saved
            </Chip>
          )}
        </div>
        <span className="ml-auto text-[13px] text-fog num" aria-live="polite">
          {resultCount} {resultCount === 1 ? "contest" : "contests"}
        </span>
      </div>
    </div>
  );
}
