import "dotenv/config";
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { importCompanyBanks } from "../../src/lib/imports/company-banks";

// CLI wrapper around the shared importer used by the in-app "Import from
// CSV" button too (src/lib/imports/company-banks.ts) -- same logic either
// way. See that file for the exact CSV format and matching rules.
//   DATABASE_URL="<connection-string>" pnpm db:import-company-banks <path-to-csv>

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , csvPath] = process.argv;
  if (!csvPath) {
    console.error("Usage: pnpm db:import-company-banks <path-to-csv>");
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, "utf8");
  const outcome = await importCompanyBanks(prisma, csvText);

  if (!outcome.ok) {
    console.error(outcome.error);
    process.exit(1);
  }

  const r = outcome.result;
  console.log(`Found ${r.rowCount} row(s), ${r.bankColumns.length} bank column(s): ${r.bankColumns.join(", ")}\n`);
  console.log(r.log.join("\n"));
  console.log(
    `\n=== Summary: ${r.companiesCreated} companies created, ${r.companiesUpdated} updated | ${r.banksCreated} bank accounts created, ${r.banksUpdated} updated, ${r.banksSkippedNotApplied} "Not Applied" skipped ===`
  );

  if (r.notes.length > 0) {
    console.log("\n=== Notes ===");
    console.log(r.notes.map((n) => `  ${n}`).join("\n"));
  }

  if (r.unmatchedBehalfOf.length > 0) {
    console.log('\n=== "Behalf Of" names not found in Employees -- add these first, then re-run ===');
    for (const name of r.unmatchedBehalfOf) console.log(`  - ${name}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
