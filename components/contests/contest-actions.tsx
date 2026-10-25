"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Bell, BellOff, Bookmark, BookmarkCheck, CalendarPlus, Check, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useContests } from "@/components/providers/contests-provider";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { googleCalendarUrl } from "@/lib/gcal";
import { useNow } from "@/hooks/use-now";
import { formatOffset } from "@/lib/time";
import { cn } from "@/lib/cn";
import { REMINDER_PRESETS, type ContestDTO } from "@/types/contest";

export function BookmarkButton({ contest, className }: { contest: ContestDTO; className?: string }) {
  const { setBookmark } = useContests();
  const on = !!contest.bookmarked;
  return (
    <button
      type="button"
      onClick={() => setBookmark(contest.id, !on)}
      aria-pressed={on}
      aria-label={on ? `Remove ${contest.name} from saved` : `Save ${contest.name}`}
      title={on ? "Saved" : "Save contest"}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), on && "text-violet-soft")}
    >
      {on ? <BookmarkCheck /> : <Bookmark />}
    </button>
  );
}

const REASON_TEXT: Record<string, string> = {
  excluded: "Off for this contest",
  disabled: "Reminders are off",
  "platform-off": "Platform not followed",
  "not-bookmarked": "Save it to get reminders",
  "no-channels": "No channel turned on",
};

export function reminderSummary(c: ContestDTO): string {
  if (!c.reminder) return "Sign in for reminders";
  if (!c.reminder.active) return REASON_TEXT[c.reminder.reason] ?? "Off";
  if (c.reminder.offsetsMinutes.length === 0) return "No reminder times";
  return `Reminders ${c.reminder.offsetsMinutes.map(formatOffset).join(", ")}`;
}

export function ReminderControl({ contest, compact }: { contest: ContestDTO; compact?: boolean }) {
  const { signedIn, setContestPref } = useContests();
  const now = useNow();
  const r = contest.reminder;
  if (now && (contest.cancelled || new Date(contest.startTime) <= now)) {
    return compact ? <span className="inline-block size-9" aria-hidden /> : null;
  }
  const active = !!r?.active;

  if (!signedIn) {
    return (
      <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: compact ? "icon" : "sm" }), "text-fog")} title="Sign in to get reminders">
        <BellOff />
        {!compact && <span>Sign in for reminders</span>}
      </Link>
    );
  }

  const offsets = r?.offsetsMinutes ?? [];
  const toggleOffset = (m: number) => {
    const next = offsets.includes(m) ? offsets.filter((o) => o !== m) : [...offsets, m];
    void setContestPref(contest.id, { offsetsOverride: next });
  };

  return (
    <Dropdown>
      <DropdownTrigger
        className={cn(buttonVariants({ variant: "ghost", size: compact ? "icon" : "sm" }), active ? "text-cyan" : "text-fog")}
        aria-label={`Reminder settings for ${contest.name}: ${reminderSummary(contest)}`}
        title={reminderSummary(contest)}
      >
        {active ? <Bell /> : <BellOff />}
        {!compact && <span className="num">{reminderSummary(contest)}</span>}
      </DropdownTrigger>
      <DropdownContent className="w-64">
        <DropdownLabel>{reminderSummary(contest)}</DropdownLabel>
        {r?.reason === "excluded" ? (
          <DropdownItem onSelect={() => setContestPref(contest.id, { excluded: false })}>
            <Bell /> Turn reminders back on
          </DropdownItem>
        ) : r?.reason === "on" ? (
          <DropdownItem onSelect={() => setContestPref(contest.id, { excluded: true })}>
            <BellOff /> Don&apos;t remind me about this one
          </DropdownItem>
        ) : (
          <DropdownItem asChild>
            <Link href="/settings">
              <Bell /> Open reminder settings
            </Link>
          </DropdownItem>
        )}
        {(r?.reason === "on" || r?.reason === "not-bookmarked") && (
          <>
            <DropdownSeparator />
            <DropdownLabel>Remind me for this contest</DropdownLabel>
            {REMINDER_PRESETS.map((p) => (
              <DM.CheckboxItem
                key={p.minutes}
                checked={offsets.includes(p.minutes)}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleOffset(p.minutes);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-white/[0.06]"
              >
                <span className="grid size-4 place-items-center rounded border border-line-strong">
                  <DM.ItemIndicator>
                    <Check className="size-3 text-violet-soft" />
                  </DM.ItemIndicator>
                </span>
                {p.label}
              </DM.CheckboxItem>
            ))}
            {r?.overridden && (
              <DropdownItem onSelect={() => setContestPref(contest.id, { offsetsOverride: null })} className="text-fog">
                Use my default times
              </DropdownItem>
            )}
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

export function CalendarMenu({ contest, compact }: { contest: ContestDTO; compact?: boolean }) {
  return (
    <Dropdown>
      <DropdownTrigger className={cn(buttonVariants({ variant: "ghost", size: compact ? "icon" : "sm" }))} aria-label={`Add ${contest.name} to calendar`} title="Add to calendar">
        <CalendarPlus />
        {!compact && <span>Add to calendar</span>}
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem asChild>
          <a href={googleCalendarUrl({ name: contest.name, platform: contest.platform, start: contest.startTime, end: contest.endTime, url: contest.url })} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Google Calendar
          </a>
        </DropdownItem>
        <DropdownItem asChild>
          <a href={`/api/contests/${contest.id}/ics`} download>
            <Download /> Download .ics (Apple, Outlook)
          </a>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
