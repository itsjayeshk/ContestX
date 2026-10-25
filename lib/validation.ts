import { z } from "zod";
import { ALLOWED_OFFSETS, PLATFORMS } from "@/types/contest";
import { isValidTimezone } from "@/lib/time";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(200, "Password is too long");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(60).optional(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone").optional(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });

const offsets = z
  .array(z.number().int().refine((n) => ALLOWED_OFFSETS.includes(n), "Unsupported reminder time"))
  .max(ALLOWED_OFFSETS.length);

const handle = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9_.-]*$/, "Handles may contain letters, digits, _ . -")
  .transform((v) => (v ? v : null));

export const preferencesSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(["ALL_QUALIFYING", "BOOKMARKED_ONLY"]),
  offsetsMinutes: offsets.min(1, "Pick at least one reminder time"),
  platforms: z.array(z.enum(PLATFORMS)).min(1, "Pick at least one platform"),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
});

export const accountSchema = z.object({
  name: z.string().trim().max(60).nullable().optional(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  codeforcesHandle: handle.nullable().optional(),
  leetcodeHandle: handle.nullable().optional(),
});

export const contestPrefSchema = z.object({
  excluded: z.boolean().optional(),
  offsetsOverride: offsets.nullable().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});
