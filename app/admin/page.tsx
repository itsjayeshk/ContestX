import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformMark } from "@/components/contests/platform-mark";
import { RetryFailedButton, SyncNowButton } from "@/components/admin/admin-actions";
import { prisma } from "@/lib/db";
import { emailConfigured, env, pushConfigured } from "@/lib/env";
import { loadFreshness } from "@/lib/queries";
import { platformName } from "@/lib/platforms";
import { formatDateTime, relativeAgo } from "@/lib/time";
import { getViewer } from "@/lib/viewer";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function StatusIcon({ status }: { status: string | null }) {
  if (status === "SUCCESS") return <CheckCircle2 className="size-4 text-ok" aria-label="Success" />;
  if (status === "PARTIAL") return <AlertTriangle className="size-4 text-amber" aria-label="Partial" />;
  return <XCircle className="size-4 text-danger" aria-label="Failed" />;
}

export default async function AdminPage() {
  const { user, timezone } = await getViewer();
  if (!user || user.role !== "ADMIN") notFound();

  const since = new Date(Date.now() - 86_400_000);
  const e = env();
  const [freshness, logs, workers, failedReminders, deliveryStats, pendingDue, counts] = await Promise.all([
    loadFreshness(),
    prisma.providerSyncLog.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.workerHeartbeat.findMany({ where: { id: { startsWith: "worker:" } }, orderBy: { lastBeat: "desc" } }),
    prisma.scheduledReminder.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 50, include: { contest: { select: { name: true, startTime: true } }, user: { select: { email: true } } } }),
    prisma.notificationDelivery.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: since }, isTest: false }, _count: true }),
    prisma.scheduledReminder.count({ where: { status: "PENDING", fireAt: { lt: new Date(Date.now() - 5 * 60_000) } } }),
    Promise.all([prisma.user.count(), prisma.contest.count({ where: { isSample: false } }), prisma.contest.count({ where: { isSample: true } }), prisma.scheduledReminder.count({ where: { status: "PENDING" } })]),
  ]);
  const [users, contests, samples, pending] = counts;
  const stat = (ch: string, st: string) => deliveryStats.find((d) => d.channel === ch && d.status === st)?._count ?? 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6">
      <PageHeader title="Admin" aside={<SyncNowButton />}>
        Provider health, the reminder worker, and delivery results.
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Accounts", users],
          ["Live contests stored", contests],
          ["Reminders pending", pending],
          ["Overdue pending (>5 min)", pendingDue],
        ].map(([label, v]) => (
          <div key={label} className="panel p-5">
            <p className="text-[13px] text-fog">{label}</p>
            <p className={cn("display num mt-3 text-3xl", label === "Overdue pending (>5 min)" && Number(v) > 0 && "text-amber")}>{v}</p>
          </div>
        ))}
      </section>
      {samples > 0 && <p className="text-[13px] text-amber">{samples} sample contests are in the database. Remove them with npm run db:seed:sample -- --remove.</p>}

      <section className="flex flex-col gap-4" aria-labelledby="providers">
        <h2 id="providers" className="heading text-xl">Providers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {freshness.map((f) => (
            <div key={f.platform} className="panel flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <PlatformMark platform={f.platform} withName />
                <StatusIcon status={f.lastStatus} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[13px]">
                <dt className="text-fog">Last success</dt>
                <dd className={cn("num", f.stale ? "text-amber" : "text-ink-2")}>{relativeAgo(f.lastSuccessAt)}</dd>
                <dt className="text-fog">Last attempt</dt>
                <dd className="num text-ink-2">{relativeAgo(f.lastAttemptAt)}</dd>
              </dl>
              {f.lastError && <p className="text-xs text-amber">{f.lastError}</p>}
              {f.stale && <p className="text-xs text-amber">Data is stale; users see a warning.</p>}
            </div>
          ))}
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-fog">
              <tr className="border-b border-line">
                {["Started", "Platform", "Result", "Fetched", "New", "Changed", "Moved", "Cancelled", "Tries", "Time", "Error"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="num divide-y divide-line text-ink-2">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-fog">No sync has run yet.</td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(l.startedAt, timezone)}</td>
                  <td className="px-3 py-2">{platformName(l.platform)}</td>
                  <td className="px-3 py-2"><StatusIcon status={l.status} /></td>
                  <td className="px-3 py-2">{l.fetchedCount}</td>
                  <td className="px-3 py-2">{l.createdCount}</td>
                  <td className="px-3 py-2">{l.updatedCount}</td>
                  <td className="px-3 py-2">{l.rescheduledCount}</td>
                  <td className="px-3 py-2">{l.cancelledCount}</td>
                  <td className="px-3 py-2">{l.attempts}</td>
                  <td className="px-3 py-2">{l.durationMs ?? "-"}ms</td>
                  <td className="max-w-72 truncate px-3 py-2 text-amber" title={l.error ?? ""}>{l.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel flex flex-col gap-3 p-5">
          <h2 className="text-[15px] font-medium">Workers</h2>
          {workers.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-amber"><AlertTriangle className="size-4" /> No worker is running. Reminders and syncs are paused.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13px]">
              {workers.map((w) => {
                const age = (Date.now() - w.lastBeat.getTime()) / 1000;
                return (
                  <li key={w.id} className="flex items-center gap-2">
                    {age < e.DISPATCH_INTERVAL_SECONDS * 4 ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-danger" />}
                    <span className="truncate text-ink-2">{w.id.replace("worker:", "")}</span>
                    <span className="num ml-auto text-fog">beat {relativeAgo(w.lastBeat)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[13px] text-fog">
            Email {emailConfigured() ? "configured" : "not configured"}, push {pushConfigured() ? "configured" : "not configured"}. Sync every {e.SYNC_INTERVAL_MINUTES} min, dispatch every {e.DISPATCH_INTERVAL_SECONDS}s.
          </p>
        </div>
        <div className="panel flex flex-col gap-3 p-5">
          <h2 className="text-[15px] font-medium">Deliveries, last 24 hours</h2>
          <table className="text-left text-[13px]">
            <thead className="text-fog">
              <tr><th className="py-1.5 font-normal">Channel</th><th className="font-normal">Sent</th><th className="font-normal">Failed</th><th className="font-normal">Skipped</th></tr>
            </thead>
            <tbody className="num text-ink-2">
              {(["IN_APP", "EMAIL", "PUSH"] as const).map((ch) => (
                <tr key={ch} className="border-t border-line">
                  <td className="py-1.5">{ch === "IN_APP" ? "In-app" : ch === "EMAIL" ? "Email" : "Push"}</td>
                  <td>{stat(ch, "SUCCESS")}</td>
                  <td className={stat(ch, "FAILED") ? "text-danger" : ""}>{stat(ch, "FAILED")}</td>
                  <td>{stat(ch, "SKIPPED")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="failed">
        <div className="flex items-center justify-between gap-4">
          <h2 id="failed" className="heading text-xl">Failed reminders <span className="num text-fog">{failedReminders.length}</span></h2>
          <RetryFailedButton ids={failedReminders.filter((r) => r.contest.startTime > new Date()).map((r) => r.id)} />
        </div>
        {failedReminders.length === 0 ? (
          <p className="text-sm text-fog">No failed reminders.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-fog">
                <tr className="border-b border-line">
                  {["Updated", "User", "Contest", "Channel", "Tries", "Error"].map((h) => <th key={h} className="px-3 py-2.5 font-normal">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-2">
                {failedReminders.map((r) => (
                  <tr key={r.id}>
                    <td className="num whitespace-nowrap px-3 py-2">{formatDateTime(r.updatedAt, timezone)}</td>
                    <td className="px-3 py-2">{r.user.email}</td>
                    <td className="max-w-56 truncate px-3 py-2">{r.contest.name}</td>
                    <td className="px-3 py-2">{r.channel}</td>
                    <td className="num px-3 py-2">{r.attempts}</td>
                    <td className="max-w-80 truncate px-3 py-2 text-danger" title={r.lastError ?? ""}>{r.lastError}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
