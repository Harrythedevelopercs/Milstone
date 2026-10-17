import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_baVm3rz1LYpg@ep-falling-block-axoykj3b-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
