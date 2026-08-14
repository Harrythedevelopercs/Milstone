import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Soft-disable only (isActive = false) -- never deletes the row, so their
// name stays intact on any historical transaction/audit record they touched.
// A disabled user's login is rejected immediately (see auth.ts).
//   DATABASE_URL="<neon-connection-string>" pnpm db:disable-user <email>
// Pass --enable to re-activate the same account instead.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , email, flag] = process.argv;
  if (!email) {
    console.error("Usage: pnpm db:disable-user <email> [--enable]");
    process.exit(1);
  }

  const isActive = flag === "--enable";
  const user = await prisma.user.update({ where: { email }, data: { isActive } });
  console.log(`${user.name} <${user.email}> is now ${isActive ? "ACTIVE" : "DISABLED"}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
