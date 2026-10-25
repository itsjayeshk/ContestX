import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { adminEmails } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";

export async function createUser(input: { email: string; password: string; name?: string; timezone?: string }) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name || null,
      timezone: input.timezone ?? "Asia/Kolkata",
      role: adminEmails().includes(input.email) ? "ADMIN" : "USER",
      calendarToken: randomBytes(24).toString("base64url"),
      reminderPreference: { create: {} },
    },
  });
}
