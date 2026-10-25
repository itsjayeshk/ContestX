import { BellRing } from "lucide-react";
import Link from "next/link";
import { PlatformMark } from "@/components/contests/platform-mark";
import { formatDateTime, formatOffset } from "@/lib/time";
import type { PlatformId } from "@/types/contest";

export interface NextReminderItem {
  id: string;
  fireAt: string;
  offsetMinutes: number;
  channels: string[];
  contestName: string;
  platform: PlatformId;
}

const CH: Record<string, string> = { EMAIL: "email", PUSH: "push", IN_APP: "in-app" };

/** The next few reminders the worker will send, so users can see the engine is armed. */
export function NextReminders({ items, timezone, signedIn }: { items: NextReminderItem[]; timezone: string; signedIn: boolean }) {
  return (
    <section className="panel flex flex-col gap-4 p-6" aria-labelledby="next-reminders">
      <div className="flex items-center justify-between">
        <h2 id="next-reminders" className="heading text-lg">
          Next reminders
        </h2>
        <BellRing className="size-4 text-fog" aria-hidden />
      </div>
      {!signedIn ? (
        <p className="text-sm text-fog">
          <Link href="/register" className="text-violet-soft hover:text-ink">Create an account</Link> and every new contest gets reminders at the times you choose, sent by the server even when this tab is closed.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fog">
          Nothing is scheduled. Check that reminders and at least one channel are on in <Link href="/settings" className="text-violet-soft hover:text-ink">settings</Link>.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <PlatformMark platform={r.platform} size="sm" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{r.contestName}</span>
              <span className="num shrink-0 text-fog">
                {formatOffset(r.offsetMinutes)} before, {formatDateTime(r.fireAt, timezone, { weekday: undefined })}, {r.channels.map((c) => CH[c]).join(" + ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {signedIn && items.length > 0 && (
        <Link href="/reminders" className="text-[13px] text-violet-soft hover:text-ink">
          All scheduled reminders
        </Link>
      )}
    </section>
  );
}
