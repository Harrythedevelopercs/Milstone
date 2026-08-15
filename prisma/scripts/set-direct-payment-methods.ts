import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-time setup: flags the direct-to-bank payment methods and creates
// Zelle if it doesn't exist yet. Safe to re-run (idempotent).
//   DATABASE_URL="<connection-string>" pnpm exec tsx prisma/scripts/set-direct-payment-methods.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DIRECT_METHOD_NAMES = ["Wire", "Cash", "ACH", "USDT", "Zelle"];

async function main() {
  const updated = await prisma.paymentMethod.updateMany({
    where: { name: { in: DIRECT_METHOD_NAMES } },
    data: { requiresMerchant: false },
  });
  console.log(`Flagged ${updated.count} existing payment method(s) as direct-to-bank.`);

  const zelle = await prisma.paymentMethod.upsert({
    where: { name: "Zelle" },
    create: { name: "Zelle", status: "ACTIVE", requiresMerchant: false },
    update: { requiresMerchant: false },
  });
  console.log(`Zelle: ${zelle.id} (requiresMerchant: ${zelle.requiresMerchant})`);

  const all = await prisma.paymentMethod.findMany({ orderBy: { name: "asc" } });
  console.log("\nFinal payment methods:");
  for (const m of all) console.log(`  - ${m.name} (${m.status}): requiresMerchant=${m.requiresMerchant}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
