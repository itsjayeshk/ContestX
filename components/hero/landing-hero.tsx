"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useContests } from "@/components/providers/contests-provider";
import { CountdownClock } from "@/components/contests/countdown";
import { PlatformMark, PlatformDot } from "@/components/contests/platform-mark";
import { SampleBadge } from "@/components/contests/contest-card";
import { MagneticButton } from "@/components/ui/magnetic";
import { useNow } from "@/hooks/use-now";
import { nextContest } from "@/lib/filter-contests";
import { PLATFORM_META } from "@/lib/platforms";
import { formatDateTime, formatDuration, zoneLabel } from "@/lib/time";
import { PLATFORMS } from "@/types/contest";
import { Hero3D } from "./hero-3d";

const WEEK_MS = 7 * 86_400_000;

export function LandingHero() {
  const { contests, timezone } = useContests();
  const now = useNow();
  const reduced = useReducedMotion();
  const ref = now ?? new Date(contests[0]?.lastFetchedAt ?? Date.now());
  const minute = Math.floor(ref.getTime() / 60_000);

  const next = useMemo(() => nextContest(contests, ref), [contests, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const orbits = useMemo(
    () =>
      PLATFORMS.map((p) => {
        const n = nextContest(contests, ref, [p]);
        const dt = n ? new Date(n.startTime).getTime() - ref.getTime() : null;
        return { color: PLATFORM_META[p].color, progress: dt !== null && dt <= WEEK_MS ? dt / WEEK_MS : null };
      }),
    [contests, minute], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const enter = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <section className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
      <div className="relative z-10 flex flex-col">
        <motion.h1 {...enter(0)} className="display text-[clamp(3rem,8.4vw,6.6rem)] text-ink">
          Never miss
          <br />a contest.
        </motion.h1>
        <motion.p {...enter(0.12)} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
          Every coding contest. One intelligent dashboard. Stay ahead of the clock.
        </motion.p>
        <motion.div {...enter(0.2)} className="mt-8 flex flex-wrap gap-3">
          <MagneticButton href="/contests" variant="primary">
            Explore Contests
          </MagneticButton>
          <MagneticButton href="/analytics" variant="secondary">
            Build Your Streak
          </MagneticButton>
        </motion.div>

        <motion.div {...enter(0.32)} className="mt-12">
          {next ? (
            <div className="flex flex-col gap-4 border-l border-violet/50 pl-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-fog">
                <span>Next contest</span>
                <PlatformMark platform={next.platform} size="sm" withName />
                {next.isSample && <SampleBadge />}
              </div>
              <a href={next.url} target="_blank" rel="noopener noreferrer" className="heading group inline-flex items-center gap-2 text-xl text-ink hover:text-violet-soft">
                {next.name}
                <ArrowUpRight className="size-4 text-fog transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <CountdownClock target={next.startTime} size="md" />
              <p className="num text-[13px] text-fog">
                {formatDateTime(next.startTime, timezone)} {zoneLabel(timezone, new Date(next.startTime))}, runs {formatDuration(next.durationSeconds)}
              </p>
            </div>
          ) : (
            <p className="max-w-md border-l border-line-strong pl-5 text-sm text-fog">
              No upcoming contest is known yet. The schedule fills in after the background worker fetches it from each platform.
            </p>
          )}
        </motion.div>
      </div>

      <div className="relative -mx-4 flex flex-col items-center sm:mx-0">
        <div className="pointer-events-none absolute inset-0 m-auto aspect-square w-4/5 rounded-full bg-violet/10 blur-[90px]" aria-hidden />
        <Hero3D orbits={orbits} />
        <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-fog" aria-label="Orbit legend">
          {PLATFORMS.map((p, i) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <PlatformDot platform={p} />
              {PLATFORM_META[p].name}
              <span className="text-fog-2">{orbits[i].progress === null ? "nothing this week" : ""}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 px-4 text-center text-xs text-fog-2">Each ring is a platform. Its light sits at that platform&apos;s next contest on a seven-day orbit.</p>
      </div>
    </section>
  );
}
