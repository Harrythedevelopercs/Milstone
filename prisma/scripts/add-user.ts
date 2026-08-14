import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// There is no in-app "add user" screen, so this is how a new team member
// gets a login. This only creates the login (User) -- if they also need to
// be tracked as a Partner (profit share) or Employee (payroll/commission),
// set that up separately under Master Data; ask to have the two linked if
// needed.
//   DATABASE_URL="<neon-connection-string>" pnpm db:add-user <email> <name> <role>
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const VALID_ROLES = ["OWNER", "ACCOUNTANT", "EMPLOYEE"];

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  const [, , email, name, role] = process.argv;
  if (!email || !name || !role || !VALID_ROLES.includes(role)) {
    console.error("Usage: pnpm db:add-user <email> \"<full name>\" <OWNER|ACCOUNTANT|EMPLOYEE>");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const generatedPassword = randomPassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);
  const user = await prisma.user.create({
    data: { email, name, role: role as "OWNER" | "ACCOUNTANT" | "EMPLOYEE", passwordHash },
  });

  console.log(`Created ${user.role} login for ${user.name} <${user.email}>`);
  console.log(`Temporary password: ${generatedPassword}`);
  console.log("There is no forced password-change screen -- share this securely and consider running db:set-password once they've picked their own.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
