"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Columns3, List, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { BookmarkButton, CalendarMenu, ReminderControl, reminderSummary } from "@/components/contests/contest-actions";
import { PlatformDot, PlatformMark } from "@/components/contests/platform-mark";
import { SampleBadge, ScheduleChange } from "@/components/contests/contest-card";
import { StatusPill } from "@/components/contests/status-pill";
import { CountdownText } from "@/components/contests/countdown";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Chip, Segmented } from "@/components/ui/chip";
import { useNow } from "@/hooks/use-now";
import { addDays, contestDayKeys, minutesIntoDay, monthGrid, parseKey, shiftMonth, weekDays } from "@/lib/calendar";
import { PLATFORM_META, platformName } from "@/lib/platforms";
import { dayKey, formatDateTime, formatDuration, formatTime, zoneLabel } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PLATFORMS, type ContestDTO, type PlatformId } from "@/types/contest";

type View = "month" | "week" | "agenda";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 40;

function monthLabel(y: number, m: number) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}
function dayLabel(key: string, opts: Intl.DateTimeFormatOptions) {
  const { y, m, d } = parseKey(key);
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function ContestCalendar() {
  const { contests, timezone } = useContests();
  const now = useNow();
  const reduced = useReducedMotion();
  const [today, setToday] = useState(() => dayKey(new Date(contests[0]?.lastFetchedAt ?? Date.now()), timezone));
  const [cursor, setCursor] = useState(today); // anchor date for week/month
  const [view, setView] = useState<View>("month");
  const [platforms, setPlatforms] = useState<PlatformId[]>([...PLATFORMS]);
  const [selected, setSelected] = useState<ContestDTO | null>(null);
  const [dir, setDir] = useState(0);

  // Settle "today" on the client clock and default small screens to the agenda.
  useEffect(() => {
    const t = dayKey(new Date(), timezone);
    setToday(t);
    setCursor(t);
    if (window.matchMedia("(max-width: 767px)").matches) setView("agenda");
  }, [timezone]);

  const byDay = useMemo(() => {
    const map = new Map<string, ContestDTO[]>();
    for (const c of contests) {
      if (!platforms.includes(c.platform)) continue;
      for (const k of contestDayKeys(c.startTime, c.endTime, timezone)) map.set(k, [...(map.get(k) ?? []), c]);
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
    return map;
  }, [contests, platforms, timezone]);

  const { y, m } = parseKey(cursor);
  const move = (delta: number) => {
    setDir(delta);
    if (view === "month") {
      const n = shiftMonth(y, m, delta);
      setCursor(`${n.y}-${String(n.m).padStart(2, "0")}-01`);
    } else setCursor(addDays(cursor, delta * (view === "week" ? 7 : 14)));
  };

  const week = weekDays(cursor);
  const title =
    view === "month"
      ? monthLabel(y, m)
      : view === "week"
        ? `${dayLabel(week[0].key, { day: "numeric", month: "short" })} to ${dayLabel(week[6].key, { day: "numeric", month: "short", year: "numeric" })}`
        : `From ${dayLabel(cursor, { day: "numeric", month: "long" })}`;

  const togglePlatform = (p: PlatformId) => {
    const all = platforms.length === PLATFORMS.length;
    if (all) return setPlatforms([p]);
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p];
    setPlatforms(next.length ? next : [...PLATFORMS]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label={`Previous ${view === "month" ? "month" : "week"}`}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label={`Next ${view === "month" ? "month" : "week"}`}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="heading min-w-48 text-xl" aria-live="polite">
          {title}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setCursor(today)}>
          Today
        </Button>
        <Segmented
          className="ml-auto"
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Month", icon: <CalendarDays /> },
            { value: "week", label: "Week", icon: <Columns3 /> },
            { value: "agenda", label: "Agenda", icon: <List /> },
          ]}
        />
      </div>
      <div role="group" aria-label="Platforms" className="flex flex-wrap gap-2">
        <Chip active={platforms.length === PLATFORMS.length} onClick={() => setPlatforms([...PLATFORMS])}>
          All platforms
        </Chip>
        {PLATFORMS.map((p) => (
          <Chip key={p} active={platforms.length !== PLATFORMS.length && platforms.includes(p)} onClick={() => togglePlatform(p)}>
            <PlatformDot platform={p} /> {PLATFORM_META[p].name}
          </Chip>
        ))}
        <span className="ml-auto self-center text-xs text-fog">Times in {timezone.replace(/_/g, " ")} ({zoneLabel(timezone)})</span>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={`${view}-${view === "month" ? `${y}-${m}` : week[0].key}`}
          initial={reduced ? false : { opacity: 0, x: dir * 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: dir * -16 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "month" && <MonthView y={y} m={m} today={today} byDay={byDay} onSelect={setSelected} />}
          {view === "week" && <WeekView days={week} today={today} byDay={byDay} onSelect={setSelected} now={now} />}
          {view === "agenda" && <AgendaView start={cursor} byDay={byDay} onSelect={setSelected} today={today} />}
        </motion.div>
      </AnimatePresence>

      <ContestPanel contest={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function EventChip({ c, onSelect, showTime = true }: { c: ContestDTO; onSelect: (c: ContestDTO) => void; showTime?: boolean }) {
  const { timezone } = useContests();
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded-[6px] px-1.5 py-1 text-left text-[12px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink",
        c.cancelled && "line-through opacity-50",
      )}
      title={`${c.name}, ${formatTime(c.startTime, timezone)}`}
    >
      <PlatformDot platform={c.platform} />
      {showTime && <span className="num shrink-0 text-fog">{formatTime(c.startTime, timezone)}</span>}
      <span className="truncate">{c.name}</span>
    </button>
  );
}

function MonthView({ y, m, today, byDay, onSelect }: { y: number; m: number; today: string; byDay: Map<string, ContestDTO[]>; onSelect: (c: ContestDTO) => void }) {
  const grid = monthGrid(y, m);
  return (
    <div className="panel overflow-hidden" role="grid" aria-label={monthLabel(y, m)}>
      <div role="row" className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div role="columnheader" key={d} className="px-3 py-2.5 text-xs text-fog">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          const items = byDay.get(day.key) ?? [];
          const isToday = day.key === today;
          return (
            <div
              role="gridcell"
              key={day.key}
              aria-label={`${dayLabel(day.key, { weekday: "long", day: "numeric", month: "long" })}, ${items.length} contests`}
              className={cn("min-h-28 border-line p-1.5", i % 7 !== 6 && "border-r", i < 35 && "border-b", !day.inMonth && "bg-black/20")}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span className={cn("num grid size-6 place-items-center rounded-full text-[12px]", isToday ? "bg-violet font-semibold text-void" : day.inMonth ? "text-ink-2" : "text-fog-2")}>{day.d}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((c) => (
                  <EventChip key={c.id} c={c} onSelect={onSelect} />
                ))}
                {items.length > 3 && <span className="px-1.5 text-[11px] text-fog">and {items.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ days, today, byDay, onSelect, now }: { days: ReturnType<typeof weekDays>; today: string; byDay: Map<string, ContestDTO[]>; onSelect: (c: ContestDTO) => void; now: Date | null }) {
  const { timezone } = useContests();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scroller) scroller.scrollTop = HOUR_PX * 7; // open around the morning
  }, [scroller]);
  const nowMin = now ? minutesIntoDay(now, timezone) : null;

  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {days.map((d) => (
          <div key={d.key} className="border-l border-line px-2 py-2.5">
            <span className="text-xs text-fog">{WEEKDAYS[d.weekday]}</span>{" "}
            <span className={cn("num text-sm", d.key === today ? "font-semibold text-violet-soft" : "text-ink-2")}>{d.d}</span>
          </div>
        ))}
      </div>
      <div ref={setScroller} className="relative max-h-[640px] overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: HOUR_PX * 24 }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="num absolute right-2 -translate-y-1/2 text-[11px] text-fog-2" style={{ top: h * HOUR_PX }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const items = byDay.get(d.key) ?? [];
            return (
              <div key={d.key} className="relative border-l border-line" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, rgb(255 255 255 / .04) ${HOUR_PX - 1}px ${HOUR_PX}px)` }}>
                {d.key === today && nowMin !== null && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-cyan" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-cyan" />
                  </div>
                )}
                {items.map((c, idx) => {
                  const startsToday = dayKey(c.startTime, timezone) === d.key;
                  const endsToday = dayKey(new Date(new Date(c.endTime).getTime() - 1), timezone) === d.key;
                  const top = startsToday ? minutesIntoDay(c.startTime, timezone) : 0;
                  const bottom = endsToday ? minutesIntoDay(c.endTime, timezone) || 1440 : 1440;
                  const height = Math.max(22, ((bottom - top) / 60) * HOUR_PX - 2);
                  const color = PLATFORM_META[c.platform].color;
                  const overlap = items.filter((o, j) => j < idx && +new Date(o.endTime) > +new Date(c.startTime)).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect(c)}
                      className={cn("absolute overflow-hidden rounded-[6px] px-1.5 py-1 text-left text-[11px] leading-tight transition-[filter] hover:brightness-125", c.cancelled && "opacity-50 line-through")}
                      style={{
                        top: (top / 60) * HOUR_PX + 1,
                        height,
                        left: 2 + overlap * 8,
                        right: 2,
                        background: `color-mix(in oklab, ${color} 16%, #15161e)`,
                        boxShadow: `inset 2px 0 0 ${color}`,
                      }}
                    >
                      <span className="block truncate text-ink">{c.name}</span>
                      {startsToday && <span className="num block text-fog">{formatTime(c.startTime, timezone)}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaView({ start, byDay, onSelect, today }: { start: string; byDay: Map<string, ContestDTO[]>; onSelect: (c: ContestDTO) => void; today: string }) {
  const { timezone } = useContests();
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i)).filter((k) => byDay.get(k)?.length);
  if (days.length === 0) {
    return <p className="panel px-5 py-10 text-sm text-fog">No contests in the two weeks from this date. Use the arrows to look further ahead.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {days.map((k) => (
        <section key={k} aria-label={dayLabel(k, { weekday: "long", day: "numeric", month: "long" })}>
          <h3 className={cn("mb-2 text-[13px]", k === today ? "text-violet-soft" : "text-fog")}>
            {k === today ? "Today, " : ""}
            {dayLabel(k, { weekday: "long", day: "numeric", month: "short" })}
          </h3>
          <ul className="panel divide-y divide-line">
            {byDay.get(k)!.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onSelect(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
                  <span className="num w-12 shrink-0 text-[13px] text-ink-2">{formatTime(c.startTime, timezone)}</span>
                  <PlatformMark platform={c.platform} size="sm" />
                  <span className={cn("min-w-0 flex-1 truncate text-sm text-ink", c.cancelled && "line-through")}>{c.name}</span>
                  <span className="num text-xs text-fog">{formatDuration(c.durationSeconds)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ContestPanel({ contest, onClose }: { contest: ContestDTO | null; onClose: () => void }) {
  const { timezone, contests } = useContests();
  // Keep the panel in sync after reminder or bookmark changes.
  const c = contest ? (contests.find((x) => x.id === contest.id) ?? contest) : null;
  return (
    <Dialog.Root open={!!c} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(26rem,100vw)] flex-col gap-6 overflow-y-auto border-l border-line bg-graphite p-6 data-[state=open]:animate-[slide-in_260ms_var(--ease-out-soft)]">
          {c && (
            <>
              <div className="flex items-start justify-between gap-3">
                <PlatformMark platform={c.platform} size="lg" withName />
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close details">
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill contest={c} />
                  {c.isSample && <SampleBadge />}
                </div>
                <Dialog.Title className="heading text-2xl">{c.name}</Dialog.Title>
                <Dialog.Description className="text-sm text-fog">
                  {[platformName(c.platform), c.division, c.kind].filter(Boolean).join(", ")}
                </Dialog.Description>
                <ScheduleChange contest={c} />
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-fog">Starts</dt>
                  <dd className="num text-ink">
                    {formatDateTime(c.startTime, timezone, { year: "numeric" })} {zoneLabel(timezone, new Date(c.startTime))}
                  </dd>
                </div>
                <div>
                  <dt className="text-fog">Duration</dt>
                  <dd className="num text-ink">{formatDuration(c.durationSeconds)}</dd>
                </div>
                <div>
                  <dt className="text-fog">Countdown</dt>
                  <dd>
                    <CountdownText contest={c} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-fog">Reminders</dt>
                  <dd className="text-ink-2">{reminderSummary(c)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <ReminderControl contest={c} />
                <CalendarMenu contest={c} />
                <BookmarkButton contest={c} />
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "primary", className: "mt-auto" })}>
                Open on {platformName(c.platform)} <ArrowUpRight />
              </a>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
