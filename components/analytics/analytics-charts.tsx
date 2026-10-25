"use client";
import { AlertTriangle, Flame, Link2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { PlatformDot } from "@/components/contests/platform-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { Segmented } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty";
import { PLATFORM_META, platformName } from "@/lib/platforms";
import type { ParticipationData } from "@/lib/participation";
import { computeStreaks, weekIndex } from "@/lib/streaks";
import { cn } from "@/lib/cn";
import type { PlatformId } from "@/types/contest";

type Range = "3m" | "6m" | "1y" | "all";
const RANGE_DAYS: Record<Range, number | null> = { "3m": 92, "6m": 183, "1y": 365, all: null };
const AXIS = { stroke: "#5f6070", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "rgba(255,255,255,0.05)", vertical: false } as const;

function ChartTooltip({ active, payload, label, formatLabel }: Partial<TooltipContentProps<number, string>> & { formatLabel?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-[10px] px-3 py-2 text-[12px] shadow-xl">
      <p className="mb-1 text-fog">{formatLabel ? formatLabel(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="num ml-auto pl-3">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function ChartPanel({ title, children, description, className, table }: { title: string; description?: string; children: React.ReactNode; className?: string; table?: React.ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cn("panel flex flex-col gap-4 p-5", className)} aria-label={title}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-fog">{description}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setShowTable((s) => !s)} className="text-xs text-fog hover:text-ink" aria-pressed={showTable}>
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {showTable ? <div className="max-h-72 overflow-auto text-[13px]">{table}</div> : children}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left">
      <thead className="text-fog">
        <tr>{head.map((h) => <th key={h} className="py-1.5 pr-4 font-normal">{h}</th>)}</tr>
      </thead>
      <tbody className="num text-ink-2">
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="py-1.5 pr-4">{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const monthKey = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
const monthLabel = (k: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${k}-15T00:00:00Z`));

export function AnalyticsDashboard({
  signedIn,
  timezone,
  participation,
  tracked,
  nowIso,
}: {
  signedIn: boolean;
  timezone: string;
  participation: ParticipationData | null;
  tracked: { platform: PlatformId; upcoming: number; completed: number }[];
  nowIso: string;
}) {
  const [range, setRange] = useState<Range>("1y");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const from = RANGE_DAYS[range] === null ? 0 : now.getTime() - RANGE_DAYS[range]! * 86_400_000;

  const parts = useMemo(() => (participation?.participations ?? []).filter((p) => new Date(p.date).getTime() >= from), [participation, from]);
  const streak = useMemo(() => computeStreaks((participation?.participations ?? []).map((p) => p.date), now), [participation, now]);
  const platformsWithData = [...new Set((participation?.participations ?? []).map((p) => p.platform))];

  const monthly = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const p of parts) {
      const k = monthKey(p.date, timezone);
      const row = map.get(k) ?? {};
      row[p.platform] = (row[p.platform] ?? 0) + 1;
      map.set(k, row);
    }
    return [...map.entries()].sort().map(([k, v]) => ({ month: k, ...v }));
  }, [parts, timezone]);

  const weekly = useMemo(() => {
    const subs = (participation?.submissions ?? []).filter((s) => new Date(s).getTime() >= Math.max(from, now.getTime() - 26 * 7 * 86_400_000));
    const thisWeek = weekIndex(now);
    const counts = new Map<number, number>();
    for (const s of subs) counts.set(weekIndex(s), (counts.get(weekIndex(s)) ?? 0) + 1);
    const weeks = Math.min(26, Math.ceil((now.getTime() - Math.max(from, now.getTime() - 26 * 7 * 86_400_000)) / (7 * 86_400_000)));
    return Array.from({ length: weeks }, (_, i) => {
      const w = thisWeek - (weeks - 1 - i);
      const monday = new Date(Date.UTC(1970, 0, 5) + w * 7 * 86_400_000);
      return { week: monday.toISOString().slice(0, 10), submissions: counts.get(w) ?? 0 };
    });
  }, [participation, from, now]);

  const distribution = useMemo(() => {
    const m = new Map<PlatformId, number>();
    for (const p of parts) m.set(p.platform, (m.get(p.platform) ?? 0) + 1);
    return [...m.entries()].map(([platform, count]) => ({ platform, name: platformName(platform), count }));
  }, [parts]);

  const failed = participation?.sources.filter((s) => !s.ok) ?? [];
  const hasHandles = !!participation;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: "3m", label: "3 months" },
            { value: "6m", label: "6 months" },
            { value: "1y", label: "1 year" },
            { value: "all", label: "All time" },
          ]}
        />
        {participation?.sources.map((s) => (
          <span key={s.platform} className="inline-flex items-center gap-1.5 text-[13px] text-fog">
            <PlatformDot platform={s.platform} />
            {platformName(s.platform)}: {s.handle}
            {!s.ok && <span className="text-amber">(unavailable)</span>}
          </span>
        ))}
      </div>

      {failed.length > 0 && (
        <p className="flex items-start gap-2 text-[13px] text-amber">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Couldn&apos;t load {failed.map((f) => `${platformName(f.platform)} (${f.error})`).join(", ")}. Charts show only the data that loaded. This retries automatically within an hour.
        </p>
      )}

      {!hasHandles && (
        <EmptyState icon={<Link2 />} title={signedIn ? "Link a handle to see your history" : "Sign in to see your contest history"}>
          <div className="flex flex-col items-start gap-3">
            <span>
              Participation, rating history, streaks and weekly activity come from your public Codeforces and LeetCode profiles. Nothing is estimated: until a handle is linked these charts stay empty.
            </span>
            <Link href={signedIn ? "/settings#account" : "/login"} className={buttonVariants({ variant: "primary", size: "sm" })}>
              {signedIn ? "Link handles in settings" : "Sign in"}
            </Link>
          </div>
        </EmptyState>
      )}

      {hasHandles && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Current streak", value: streak.current, unit: streak.current === 1 ? "week" : "weeks", icon: Flame, hint: "consecutive weeks with a rated contest" },
              { label: "Longest streak", value: streak.longest, unit: streak.longest === 1 ? "week" : "weeks", icon: Trophy, hint: "all time" },
              { label: "Contests in range", value: parts.length, unit: "", icon: Link2, hint: `${platformsWithData.map(platformName).join(" and ") || "no platform"} data` },
            ].map((s) => (
              <div key={s.label} className="panel p-5">
                <div className="flex items-center justify-between text-[13px] text-fog">
                  {s.label} <s.icon className="size-4" aria-hidden />
                </div>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="display num text-[40px]">{s.value}</span>
                  <span className="text-sm text-fog">{s.unit}</span>
                </p>
                <p className="mt-1 text-xs text-fog">{s.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(["CODEFORCES", "LEETCODE"] as const)
              .filter((p) => participation.sources.some((s) => s.platform === p))
              .map((p) => {
                const data = parts.filter((x) => x.platform === p && x.ratingAfter !== null).map((x) => ({ date: x.date.slice(0, 10), rating: x.ratingAfter, contest: x.contestName }));
                return (
                  <ChartPanel
                    key={p}
                    title={`${platformName(p)} rating`}
                    description="Rating after each contest"
                    table={<SimpleTable head={["Date", "Contest", "Rating"]} rows={data.map((d) => [d.date, d.contest, d.rating ?? ""])} />}
                  >
                    {data.length === 0 ? (
                      <p className="py-16 text-center text-sm text-fog">No rated {platformName(p)} contests in this range.</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer>
                          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                            <CartesianGrid {...GRID} />
                            <XAxis dataKey="date" {...AXIS} minTickGap={40} tickFormatter={(d: string) => monthLabel(d.slice(0, 7))} />
                            <YAxis {...AXIS} domain={["auto", "auto"]} width={44} />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,.15)" }} />
                            <Line type="monotone" dataKey="rating" name="Rating" stroke={PLATFORM_META[p].color} strokeWidth={2} dot={data.length < 30 ? { r: 3, strokeWidth: 0, fill: PLATFORM_META[p].color } : false} activeDot={{ r: 5, stroke: "#15161e", strokeWidth: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartPanel>
                );
              })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <ChartPanel
              title="Contests per month"
              table={<SimpleTable head={["Month", ...platformsWithData.map(platformName)]} rows={monthly.map((m) => [monthLabel(m.month), ...platformsWithData.map((p) => (m as Record<string, number | string>)[p] ?? 0)])} />}
            >
              {monthly.length === 0 ? (
                <p className="py-16 text-center text-sm text-fog">No contests in this range.</p>
              ) : (
                <>
                  <Legend platforms={platformsWithData} />
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="month" {...AXIS} tickFormatter={monthLabel} />
                        <YAxis {...AXIS} allowDecimals={false} width={36} />
                        <Tooltip content={<ChartTooltip formatLabel={monthLabel} />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                        {platformsWithData.map((p, i) => (
                          <Bar key={p} dataKey={p} name={platformName(p)} stackId="a" fill={PLATFORM_META[p].color} stroke="#15161e" strokeWidth={2} radius={i === platformsWithData.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </ChartPanel>
            <ChartPanel title="By platform" description="Contests you took part in" table={<SimpleTable head={["Platform", "Contests"]} rows={distribution.map((d) => [d.name, d.count])} />}>
              {distribution.length === 0 ? (
                <p className="py-16 text-center text-sm text-fog">No contests in this range.</p>
              ) : (
                <ul className="flex flex-col gap-4 py-2">
                  {distribution.map((d) => {
                    const max = Math.max(...distribution.map((x) => x.count));
                    return (
                      <li key={d.platform} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-ink-2">{d.name}</span>
                          <span className="num text-ink">{d.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05]">
                          <div className="h-2 rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: PLATFORM_META[d.platform].color }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ChartPanel>
          </div>

          <ChartPanel
            title="Weekly coding activity"
            description="Codeforces submissions per week (up to the last 26 weeks)"
            table={<SimpleTable head={["Week of", "Submissions"]} rows={weekly.map((w) => [w.week, w.submissions])} />}
          >
            {!participation.sources.some((s) => s.platform === "CODEFORCES" && s.ok) ? (
              <p className="py-12 text-center text-sm text-fog">Link a Codeforces handle to see weekly submission activity. LeetCode doesn&apos;t publish dated submissions publicly.</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={weekly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="18%">
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="week" {...AXIS} minTickGap={30} tickFormatter={(w: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(w))} />
                    <YAxis {...AXIS} allowDecimals={false} width={36} />
                    <Tooltip content={<ChartTooltip formatLabel={(w) => `Week of ${w}`} />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                    <Bar dataKey="submissions" name="Submissions" fill="#8b7bff" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartPanel>
        </>
      )}

      <ChartPanel
        title="Contests ContestX is tracking"
        description="Upcoming versus finished, from live platform data (sample rows excluded)"
        table={<SimpleTable head={["Platform", "Upcoming", "Finished"]} rows={tracked.map((t) => [platformName(t.platform), t.upcoming, t.completed])} />}
      >
        {tracked.every((t) => t.upcoming + t.completed === 0) ? (
          <p className="py-10 text-center text-sm text-fog">No live contest data yet. This fills in once the worker has synced the platforms.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-3">
            {tracked.map((t) => {
              const total = t.upcoming + t.completed || 1;
              return (
                <li key={t.platform} className="flex flex-col gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                    <PlatformDot platform={t.platform} /> {platformName(t.platform)}
                  </span>
                  <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
                    <div style={{ width: `${(t.upcoming / total) * 100}%`, background: PLATFORM_META[t.platform].color }} />
                    <div className="flex-1 bg-white/[0.08]" />
                  </div>
                  <span className="num text-xs text-fog">
                    {t.upcoming} upcoming, {t.completed} finished
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ChartPanel>
    </div>
  );
}

function Legend({ platforms }: { platforms: PlatformId[] }) {
  if (platforms.length < 2) return null;
  return (
    <ul className="flex gap-4 text-xs text-fog" aria-label="Legend">
      {platforms.map((p) => (
        <li key={p} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: PLATFORM_META[p].color }} /> {platformName(p)}
        </li>
      ))}
    </ul>
  );
}
