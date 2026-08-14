import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

async function upsertUser(params: {
  email: string;
  name: string;
  role: "OWNER" | "ACCOUNTANT" | "EMPLOYEE";
}) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) return { user: existing, generatedPassword: null as string | null };

  const generatedPassword = randomPassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);
  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      role: params.role,
      passwordHash,
      mustChangePassword: true,
    },
  });
  return { user, generatedPassword };
}

async function main() {
  const credentialsToPrint: { name: string; email: string; password: string }[] = [];

  // --- Owners (full access + month reopen) ---
  const owners = [
    { email: "farhan@foundapay.com", name: "Farhan", profitSharePercent: "43.00" },
    { email: "mukkarram97@gmail.com", name: "Mukkarram", profitSharePercent: "33.00" },
    { email: "mahdi@foundapay.com", name: "Mahdi", profitSharePercent: "20.00" },
  ];
  for (const o of owners) {
    const { user, generatedPassword } = await upsertUser({
      email: o.email,
      name: o.name,
      role: "OWNER",
    });
    if (generatedPassword) credentialsToPrint.push({ name: o.name, email: o.email, password: generatedPassword });

    await prisma.partner.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: o.name,
        profitSharePercent: o.profitSharePercent,
      },
    });
  }

  // --- Accountant (full operational access, approvals, month close) ---
  {
    const { user, generatedPassword } = await upsertUser({
      email: "shilpa@foundapay.com",
      name: "Shilpa",
      role: "ACCOUNTANT",
    });
    if (generatedPassword) credentialsToPrint.push({ name: "Shilpa", email: "shilpa@foundapay.com", password: generatedPassword });
  }

  // --- Employees (entry-screen-only access) ---
  const employees = [
    { email: "fardeen@foundapay.com", name: "Fardeen" },
    { email: "farrukh@foundapay.com", name: "Farrukh" },
  ];
  for (const e of employees) {
    const { user, generatedPassword } = await upsertUser({
      email: e.email,
      name: e.name,
      role: "EMPLOYEE",
    });
    if (generatedPassword) credentialsToPrint.push({ name: e.name, email: e.email, password: generatedPassword });

    await prisma.employee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: e.name,
        email: e.email,
      },
    });
  }

  // --- Reference lists (payment/payout methods) ---
  const paymentMethods = ["Visa", "Mastercard", "Amex", "ACH", "Wire", "USDT", "Cash"];
  for (const name of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
  }

  const payoutMethods = ["Wire", "ACH", "USDT", "Cash"];
  for (const name of payoutMethods) {
    await prisma.payoutMethod.upsert({ where: { name }, update: {}, create: { name } });
  }

  if (credentialsToPrint.length > 0) {
    console.log("\n=== Generated login credentials (shown once — save these) ===");
    for (const c of credentialsToPrint) {
      console.log(`${c.name.padEnd(10)} ${c.email.padEnd(28)} ${c.password}`);
    }
    console.log("Each user must change their password on first login.\n");
  } else {
    console.log("\nAll users already existed — no new credentials generated.\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
