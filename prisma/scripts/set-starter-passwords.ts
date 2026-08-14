import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-time bulk reset: sets every user EXCEPT the given email to the
// standard starter password and flags them to change it on next login.
//   DATABASE_URL="<neon-connection-string>" pnpm exec tsx prisma/scripts/set-starter-passwords.ts <email-to-exclude>
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const STARTER_PASSWORD = "Found@pay123!";

async function main() {
  const [, , excludeEmail] = process.argv;
  if (!excludeEmail) {
    console.error("Usage: DATABASE_URL=... pnpm exec tsx prisma/scripts/set-starter-passwords.ts <email-to-exclude>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(STARTER_PASSWORD, 12);
  const targets = await prisma.user.findMany({ where: { email: { not: excludeEmail } } });
  if (targets.length === 0) {
    console.log("No users to update (only the excluded email exists).");
    return;
  }

  await prisma.user.updateMany({
    where: { email: { not: excludeEmail } },
    data: { passwordHash, mustChangePassword: true },
  });

  console.log(`Updated ${targets.length} user(s) to the starter password, flagged must-change-password:`);
  for (const u of targets) console.log(`  - ${u.name} <${u.email}> (${u.role})`);
  console.log(`Left untouched: ${excludeEmail}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
