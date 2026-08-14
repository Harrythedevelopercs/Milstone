import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// There is no in-app password-change screen (self-service or admin), so this
// is the only way to rotate a user's password. Run against production with:
//   DATABASE_URL="<neon-connection-string>" pnpm db:set-password <email> <new-password>
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error("Usage: pnpm db:set-password <email> <new-password>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash, mustChangePassword: false },
  });
  console.log(`Password updated for ${user.name} <${user.email}>.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
