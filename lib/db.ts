import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrisma(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set");
  // Force UTC on every connection so raw SQL and timestamp columns agree.
  const adapter = new PrismaPg({ connectionString: url, options: "-c timezone=UTC" });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
