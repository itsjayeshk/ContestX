"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlatformMark } from "@/components/contests/platform-mark";
import { api } from "@/lib/api-client";
import { formatCountdownShort } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ContestDTO } from "@/types/contest";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ContestDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    api<{ contests: ContestDTO[] }>("/api/contests")
      .then((d) => {
        setItems(d.contests);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [open]);

  const results = useMemo(() => {
    const now = Date.now();
    const list = (items ?? []).filter((c) => new Date(c.endTime).getTime() > now && !c.cancelled);
    const needle = q.trim().toLowerCase();
    return (needle ? list.filter((c) => c.name.toLowerCase().includes(needle)) : list).slice(0, 8);
  }, [items, q]);

  const go = (c?: ContestDTO) => {
    onOpenChange(false);
    if (c) window.open(c.url, "_blank", "noopener,noreferrer");
    else router.push(`/contests?q=${encodeURIComponent(q)}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_160ms]" />
        <Dialog.Content
          className="glass fixed left-1/2 top-[14vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[16px] shadow-[0_40px_120px_-30px_rgb(0_0_0/.9)] data-[state=open]:animate-[dialog-in_200ms_var(--ease-out-soft)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            }
          }}
        >
          <Dialog.Title className="sr-only">Search contests</Dialog.Title>
          <Dialog.Description className="sr-only">Type to filter upcoming contests. Enter opens the selected contest.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-fog" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Find a contest"
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
              className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-fog-2 focus:outline-none"
            />
            <kbd className="rounded border border-line px-1.5 text-[11px] text-fog-2">Esc</kbd>
          </div>
          <ul id="search-results" role="listbox" ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {error && <li className="px-3 py-6 text-[13px] text-danger">{error}</li>}
            {!error && items === null && [0, 1, 2].map((i) => <li key={i} className="skeleton mx-1 my-2 h-10" />)}
            {items && results.length === 0 && <li className="px-3 py-6 text-[13px] text-fog">No upcoming contest matches “{q}”.</li>}
            {results.map((c, i) => (
              <li
                key={c.id}
                id={`sr-${c.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5", i === active && "bg-white/[0.06]")}
              >
                <PlatformMark platform={c.platform} size="sm" />
                <span className="flex-1 truncate text-sm text-ink">{c.name}</span>
                <span className="num text-xs text-fog">{formatCountdownShort(c.startTime)}</span>
                {i === active && <CornerDownLeft className="size-3.5 text-fog" aria-hidden />}
              </li>
            ))}
          </ul>
          {q && (
            <button type="button" onClick={() => go()} className="w-full border-t border-line px-5 py-3 text-left text-[13px] text-fog hover:bg-white/[0.03] hover:text-ink">
              See all results for “{q}” in the contest explorer
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
