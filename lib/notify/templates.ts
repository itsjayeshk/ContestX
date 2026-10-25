import { platformName } from "@/lib/platforms";
import { formatDateTime, formatDuration, formatOffset, zoneLabel } from "@/lib/time";
import type { PlatformId } from "@/types/contest";
import type { NotificationMessage } from "./types";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export interface ReminderTemplateInput {
  contestName: string;
  platform: PlatformId;
  startTime: Date;
  durationSeconds: number;
  url: string;
  offsetMinutes: number;
  timezone: string;
  now: Date;
  previousStartTime?: Date | null;
  appUrl: string;
}

export function reminderMessage(i: ReminderTemplateInput): NotificationMessage {
  const minutesLeft = Math.max(1, Math.round((i.startTime.getTime() - i.now.getTime()) / 60_000));
  const when = formatDateTime(i.startTime, i.timezone);
  const zone = zoneLabel(i.timezone, i.startTime);
  const left = minutesLeft >= 90 ? formatOffset(Math.round(minutesLeft / 60) * 60) : `${minutesLeft}m`;
  const pname = platformName(i.platform);
  const title = `${i.contestName} starts in ${left}`;
  const moved = i.previousStartTime
    ? ` Schedule changed: it was planned for ${formatDateTime(i.previousStartTime, i.timezone)} ${zone}.`
    : "";
  const body = `${pname}, ${when} ${zone}, ${formatDuration(i.durationSeconds)}.${moved}`;
  const settingsUrl = `${i.appUrl.replace(/\/$/, "")}/settings`;

  const text = [
    title,
    "",
    `Platform: ${pname}`,
    `Starts: ${when} ${zone}`,
    `Duration: ${formatDuration(i.durationSeconds)}`,
    moved ? moved.trim() : "",
    "",
    `Open the contest: ${i.url}`,
    "",
    `You get this because reminders are on in ContestX. Change them at ${settingsUrl}`,
  ]
    .filter((l, idx, arr) => !(l === "" && arr[idx - 1] === ""))
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#07070b;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e9e9f0">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#14151c;border:1px solid #26273280;border-radius:12px;padding:28px">
<tr><td style="font-size:13px;color:#8d8e9c;padding-bottom:12px">ContestX reminder</td></tr>
<tr><td style="font-size:22px;font-weight:600;line-height:1.3;padding-bottom:16px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c9c9d4">
${escape(pname)}<br>${escape(when)} ${escape(zone)}<br>${escape(formatDuration(i.durationSeconds))}
${moved ? `<br><span style="color:#f0c674">${escape(moved.trim())}</span>` : ""}
</td></tr>
<tr><td style="padding-top:24px"><a href="${escape(i.url)}" style="display:inline-block;background:#8b7bff;color:#0a0a10;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Open contest</a></td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#6c6d7a">You get this because reminders are on in ContestX. <a href="${escape(settingsUrl)}" style="color:#8d8e9c">Change reminder settings</a>.</td></tr>
</table></td></tr></table></body></html>`;

  return { title, body, url: i.url, subject: title, text, html };
}

export function testMessage(channel: "email" | "push", appUrl: string): NotificationMessage {
  const title = channel === "email" ? "ContestX test email" : "ContestX test notification";
  const body = "If you can read this, this channel can deliver contest reminders.";
  return {
    title,
    body,
    subject: title,
    url: `${appUrl.replace(/\/$/, "")}/settings`,
    text: `${title}\n\n${body}`,
    html: `<p style="font-family:sans-serif">${escape(body)}</p>`,
  };
}
