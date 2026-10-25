/** Monday-based week index (UTC) for streak math. */
export function weekIndex(d: Date | string): number {
  const t = new Date(d).getTime();
  // 1970-01-05 was a Monday.
  return Math.floor((t - Date.UTC(1970, 0, 5)) / (7 * 86_400_000));
}

/**
 * Streak = consecutive weeks with at least one contest. The current streak stays alive
 * through the current week if last week had a contest.
 */
export function computeStreaks(dates: (Date | string)[], now: Date = new Date()): { current: number; longest: number; activeWeeks: number } {
  const weeks = [...new Set(dates.map(weekIndex))].sort((a, b) => a - b);
  if (weeks.length === 0) return { current: 0, longest: 0, activeWeeks: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = weeks[i] === weeks[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const thisWeek = weekIndex(now);
  const set = new Set(weeks);
  let cursor = set.has(thisWeek) ? thisWeek : thisWeek - 1;
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, longest, activeWeeks: weeks.length };
}
