import Link from "next/link";
import { LogoMark } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-[13px] text-fog sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-5 opacity-70" />
          <span>Schedules come from each platform. Always confirm times on the contest page.</span>
        </div>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/contests" className="hover:text-ink">Contests</Link>
          <Link href="/settings" className="hover:text-ink">Reminder settings</Link>
          <a href="/api/health" className="hover:text-ink">Status</a>
        </nav>
      </div>
    </footer>
  );
}
