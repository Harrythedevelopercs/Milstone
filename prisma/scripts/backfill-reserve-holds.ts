import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-time backfill: creates ReserveHold rows for transactions that already
// have a merchantReserveAmount/fpReserveAmount but predate the ReserveHold
// feature. Safe to re-run -- skips any transaction that already has a
// ReserveHold for a given owner. Run against production with:
//   DATABASE_URL="<neon-connection-string>" pnpm db:backfill-reserve-holds <performed-by-email>
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , email] = process.argv;
  if (!email) {
    console.error("Usage: pnpm db:backfill-reserve-holds <performed-by-email>");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ merchantReserveAmount: { gt: 0 } }, { fpReserveAmount: { gt: 0 } }],
    },
    include: { reserveHolds: true },
  });

  let created = 0;
  for (const t of transactions) {
    const hasClientHold = t.reserveHolds.some((h) => h.direction === "CLIENT_HELD" || h.direction === "FP_FRONTED");
    const hasFpHold = t.reserveHolds.some((h) => h.direction === "FP_OWN");

    if (Number(t.merchantReserveAmount) > 0 && !hasClientHold) {
      await prisma.reserveHold.create({
        data: {
          transactionId: t.id,
          merchantId: t.merchantId,
          // Backfilled rows predate direction tracking entirely -- default
          // to CLIENT_HELD, the historical behavior before this feature.
          direction: "CLIENT_HELD",
          originalAmount: t.merchantReserveAmount,
          heldSince: t.transactionDate,
          createdById: user.id,
        },
      });
      created++;
    }
    if (Number(t.fpReserveAmount) > 0 && !hasFpHold) {
      await prisma.reserveHold.create({
        data: {
          transactionId: t.id,
          merchantId: t.merchantId,
          direction: "FP_OWN",
          originalAmount: t.fpReserveAmount,
          heldSince: t.transactionDate,
          createdById: user.id,
        },
      });
      created++;
    }
  }

  console.log(`Scanned ${transactions.length} transaction(s) with a reserve, created ${created} ReserveHold row(s).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
