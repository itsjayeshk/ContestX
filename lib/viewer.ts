import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/time";

/** Signed-in user (or null) and the timezone to render in: account setting, then guest cookie, then IST. */
export async function getViewer(): Promise<{ user: SessionUser | null; timezone: string }> {
  const user = await getCurrentUser();
  if (user) return { user, timezone: user.timezone };
  const tz = (await cookies()).get("cx_tz")?.value;
  return { user: null, timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE };
}
