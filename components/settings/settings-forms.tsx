"use client";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Loader2, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { PlatformDot } from "@/components/contests/platform-mark";
import { TimezonePicker } from "./timezone-picker";
import { api } from "@/lib/api-client";
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/push-client";
import { PLATFORM_META } from "@/lib/platforms";
import { cn } from "@/lib/cn";
import { PLATFORMS, REMINDER_PRESETS, type PlatformId } from "@/types/contest";

export interface Prefs {
  enabled: boolean;
  scope: "ALL_QUALIFYING" | "BOOKMARKED_ONLY";
  offsetsMinutes: number[];
  platforms: PlatformId[];
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

export interface ServerCaps {
  emailConfigured: boolean;
  pushConfigured: boolean;
  vapidPublicKey: string | null;
  pushSubscriptions: number;
  email: string;
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-6 border-t border-line py-10 lg:grid-cols-[18rem_1fr]">
      <div>
        <h2 id={`${id}-title`} className="heading text-lg">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-fog">{description}</p>}
      </div>
      <div className="flex max-w-2xl flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ title, hint, children, htmlFor }: { title: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={htmlFor} className="text-sm text-ink">
          {title}
        </label>
        {hint && <div className="mt-0.5 text-[13px] text-fog">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ReminderSettings({ initial, caps }: { initial: Prefs; caps: ServerCaps }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  const save = (next: Prefs = prefs) =>
    startSave(async () => {
      try {
        const r = await api<{ pending: number }>("/api/preferences", { method: "PUT", json: next });
        setError(null);
        toast.success("Reminder settings saved", { description: `${r.pending} reminder${r.pending === 1 ? "" : "s"} now scheduled.` });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });

  const set = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const toggleOffset = (m: number) => set({ offsetsMinutes: prefs.offsetsMinutes.includes(m) ? prefs.offsetsMinutes.filter((o) => o !== m) : [...prefs.offsetsMinutes, m] });
  const togglePlatform = (p: PlatformId) => set({ platforms: prefs.platforms.includes(p) ? prefs.platforms.filter((x) => x !== p) : [...prefs.platforms, p] });

  return (
    <>
      <Section id="reminders" title="Automatic reminders" description="Every contest that matches these settings gets reminders scheduled as soon as it is announced. You can still change or switch off reminders for a single contest from its menu.">
        <Row title="Send automatic reminders" hint="Turn off to pause every reminder without losing your choices." htmlFor="enabled">
          <Switch id="enabled" checked={prefs.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </Row>
        <div className={cn("flex flex-col gap-6", !prefs.enabled && "pointer-events-none opacity-45")} aria-disabled={!prefs.enabled}>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm text-ink">Which contests</legend>
            {(
              [
                ["ALL_QUALIFYING", "Every contest on the platforms below", "Skip any one you don't want from its reminder menu."],
                ["BOOKMARKED_ONLY", "Only contests I save", "Nothing is sent unless you save the contest first."],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className={cn("flex cursor-pointer gap-3 rounded-[10px] border p-3.5 transition-colors", prefs.scope === v ? "border-violet/50 bg-violet/[0.07]" : "border-line hover:border-line-strong")}>
                <input type="radio" name="scope" value={v} checked={prefs.scope === v} onChange={() => set({ scope: v })} className="mt-1 accent-[#8b7bff]" />
                <span>
                  <span className="block text-sm text-ink">{label}</span>
                  <span className="block text-[13px] text-fog">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm text-ink">Platforms</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Chip key={p} active={prefs.platforms.includes(p)} onClick={() => togglePlatform(p)}>
                  <PlatformDot platform={p} /> {PLATFORM_META[p].name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm text-ink">Default reminder times</legend>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((p) => (
                <Chip key={p.minutes} active={prefs.offsetsMinutes.includes(p.minutes)} onClick={() => toggleOffset(p.minutes)}>
                  {p.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-fog">Reminder times that have already passed when a contest is announced are skipped rather than sent late.</p>
          </fieldset>
        </div>
      </Section>

      <Section id="channels" title="Where reminders go" description="Pick one or more. Delivery depends on the email provider and your browser, so each attempt is logged on the Reminders page.">
        <Row title="In-app" hint="In the bell menu at the top of every page." htmlFor="inapp">
          <Switch id="inapp" checked={prefs.inAppEnabled} onCheckedChange={(v) => set({ inAppEnabled: v })} />
        </Row>
        <EmailChannel caps={caps} on={prefs.emailEnabled} onChange={(v) => set({ emailEnabled: v })} />
        <PushChannel caps={caps} on={prefs.pushEnabled} onChange={(v) => set({ pushEnabled: v })} />
      </Section>

      <div className="sticky bottom-4 z-20 flex h-0 items-end justify-end">
        <div className={cn("glass flex items-center gap-3 rounded-[12px] px-4 py-3 transition-opacity", dirty || error ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!dirty && !error}>
          <FieldError>{error}</FieldError>
          {!error && <span className="text-[13px] text-fog">Unsaved changes</span>}
          <Button variant="ghost" size="sm" onClick={() => setPrefs(initial)} disabled={saving}>
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={() => save()} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save reminder settings
          </Button>
        </div>
      </div>
    </>
  );
}

function EmailChannel({ caps, on, onChange }: { caps: ServerCaps; on: boolean; onChange: (v: boolean) => void }) {
  const [sending, setSending] = useState(false);
  const test = async () => {
    setSending(true);
    try {
      await api("/api/notifications/test-email", { method: "POST" });
      toast.success("Test email accepted by the email provider", { description: `Check ${caps.email}. It can take a minute and may land in spam the first time.` });
    } catch (e) {
      toast.error("Test email failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Row
        title="Email"
        htmlFor="email"
        hint={
          caps.emailConfigured ? (
            <>Sent to {caps.email}</>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber">
              <AlertTriangle className="size-3.5" /> Email isn&apos;t configured on this server yet (RESEND_API_KEY, EMAIL_FROM).
            </span>
          )
        }
      >
        <Switch id="email" checked={on && caps.emailConfigured} disabled={!caps.emailConfigured} onCheckedChange={onChange} />
      </Row>
      {caps.emailConfigured && (
        <Button variant="secondary" size="sm" className="self-start" onClick={test} disabled={sending}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />} Send test email
        </Button>
      )}
    </div>
  );
}

function PushChannel({ caps, on, onChange }: { caps: ServerCaps; on: boolean; onChange: (v: boolean) => void }) {
  const router = useRouter();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupport(pushSupport());
    currentSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
  }, []);

  const enable = async () => {
    if (!caps.vapidPublicKey) return;
    setBusy(true);
    try {
      await enablePush(caps.vapidPublicKey);
      setSubscribed(true);
      onChange(true);
      setSupport(pushSupport());
      toast.success("Push notifications are on for this browser");
      router.refresh();
    } catch (e) {
      setSupport(pushSupport());
      toast.error(e instanceof Error ? e.message : "Could not turn on push notifications");
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      setSubscribed(false);
      toast.success("This browser will no longer get push notifications");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    try {
      const r = await api<{ detail?: string }>("/api/push/test", { method: "POST" });
      toast.success("Test notification sent", { description: r.detail ? `Reached ${r.detail}.` : undefined });
    } catch (e) {
      toast.error("Test notification failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  let status: React.ReactNode;
  if (!caps.pushConfigured) status = <span className="inline-flex items-center gap-1.5 text-amber"><AlertTriangle className="size-3.5" /> Push isn&apos;t configured on this server yet (VAPID keys).</span>;
  else if (support === "unsupported") status = <span className="text-amber">This browser doesn&apos;t support web push. On iPhone, add ContestX to your home screen first.</span>;
  else if (support === "denied") status = <span className="text-amber">Notifications are blocked for this site. Allow them in your browser&apos;s site settings.</span>;
  else if (subscribed) status = <span className="inline-flex items-center gap-1.5 text-ok"><CheckCircle2 className="size-3.5" /> This browser is subscribed{caps.pushSubscriptions > 1 ? `, plus ${caps.pushSubscriptions - 1} other` : ""}.</span>;
  else status = caps.pushSubscriptions > 0 ? `${caps.pushSubscriptions} other browser${caps.pushSubscriptions > 1 ? "s" : ""} subscribed. Not this one yet.` : "No browser subscribed yet.";

  return (
    <div className="flex flex-col gap-2">
      <Row title="Browser push" hint={status} htmlFor="push">
        <Switch id="push" checked={on && caps.pushConfigured} disabled={!caps.pushConfigured} onCheckedChange={onChange} />
      </Row>
      {caps.pushConfigured && support !== "unsupported" && (
        <div className="flex flex-wrap gap-2">
          {!subscribed ? (
            <Button variant="secondary" size="sm" onClick={enable} disabled={busy || support === "denied"}>
              {busy && <Loader2 className="animate-spin" />} Allow notifications in this browser
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={test} disabled={busy}>
                <Send /> Send test notification
              </Button>
              <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
                Stop notifications in this browser
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function CalendarFeed({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Feed URL copied");
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it manually.");
    }
  };
  const rotate = async () => {
    if (!confirm("Create a new feed URL? Calendars subscribed to the old one will stop updating.")) return;
    setBusy(true);
    try {
      const r = await api<{ url: string }>("/api/account/calendar-token", { method: "POST" });
      setUrl(r.url);
      toast.success("New feed URL created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create a new URL");
    } finally {
      setBusy(false);
    }
  };
  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <Section id="calendar" title="Calendar feed" description="A private feed of the contests you follow, with alarms at your reminder times. Calendar apps refresh subscribed feeds on their own schedule, from a few minutes to a day.">
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="Calendar feed URL" onFocus={(e) => e.currentTarget.select()} className="num text-[13px]" />
        <Button variant="secondary" onClick={copy} aria-label="Copy feed URL">
          <Copy />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Subscribe in Google Calendar
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={webcal}>
            <ExternalLink /> Open in Apple Calendar or Outlook
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={rotate} disabled={busy}>
          <RotateCcw /> New URL
        </Button>
      </div>
      {isLocal && <p className="text-[13px] text-amber">This server runs on localhost, so Google Calendar can&apos;t reach the feed. Subscriptions work once the app is deployed at a public URL.</p>}
      <p className="text-[13px] text-fog">Anyone with this URL can see which contests you follow. Create a new URL if it leaks.</p>
    </Section>
  );
}

export function AccountSettings({ initial }: { initial: { name: string | null; email: string; timezone: string; codeforcesHandle: string | null; leetcodeHandle: string | null } }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: initial.name ?? "", codeforcesHandle: initial.codeforcesHandle ?? "", leetcodeHandle: initial.leetcodeHandle ?? "" });
  const [tz, setTz] = useState(initial.timezone);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        await api("/api/account", { method: "PUT", json: { name: form.name || null, timezone: tz, codeforcesHandle: form.codeforcesHandle, leetcodeHandle: form.leetcodeHandle } });
        setError(null);
        toast.success("Account saved");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  };
  return (
    <Section id="account" title="Account" description="Your timezone controls every time shown in ContestX and in your emails. Handles are used to build your participation streak and analytics from the platforms' public data.">
      <div className="flex flex-col gap-2">
        <Label>Timezone</Label>
        <TimezonePicker value={tz} onSaved={setTz} />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} autoComplete="nickname" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cf">Codeforces handle</Label>
            <Input id="cf" value={form.codeforcesHandle} onChange={(e) => setForm({ ...form, codeforcesHandle: e.target.value })} placeholder="your_handle" maxLength={40} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lc">LeetCode username</Label>
            <Input id="lc" value={form.leetcodeHandle} onChange={(e) => setForm({ ...form, leetcodeHandle: e.target.value })} maxLength={40} autoComplete="off" />
          </div>
        </div>
        <p className="text-[13px] text-fog">CodeChef has no public source for contest history we can use, so CodeChef contests don&apos;t count toward analytics yet.</p>
        <FieldError>{error}</FieldError>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save account
          </Button>
          <span className="text-[13px] text-fog">Signed in as {initial.email}</span>
        </div>
      </form>
      <Link href="/reminders" className="text-[13px] text-violet-soft hover:text-ink">
        Manage saved contests and scheduled reminders
      </Link>
    </Section>
  );
}
