import "server-only";
import { z } from "zod";

const optional = z.string().trim().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CRON_SECRET: optional,
  ADMIN_EMAILS: z.string().default(""),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(10).max(180).default(20),
  DISPATCH_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
  PAST_CONTEST_RETENTION_DAYS: z.coerce.number().int().min(7).max(730).default(180),
  PROVIDER_CONTACT: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function adminEmails(): string[] {
  return env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function emailConfigured(): boolean {
  const e = env();
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}
