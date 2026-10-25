import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Reject cross-site state-changing requests (defence in depth on top of SameSite=Lax). */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers / server tests
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked");
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in to use this feature");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Admins only");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
  return parsed.data;
}

/** Wrap a route handler with consistent JSON errors and logging. */
export function route<A extends unknown[]>(handler: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ...rest);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      logger.error({ err, url: req.url }, "unhandled route error");
      return NextResponse.json({ error: "Something went wrong on the server. Try again." }, { status: 500 });
    }
  };
}
