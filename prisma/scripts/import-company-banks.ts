import "dotenv/config";
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Re-runnable: safe to run again after fixing the sheet or adding missing
// employees. Matches companies/bank accounts by name each time rather than
// tracking import IDs, so it only ever creates or updates, never duplicates.
//   DATABASE_URL="<connection-string>" pnpm db:import-company-banks <path-to-csv>
//
// Expected CSV columns: "Company Name", "Behalf Of", then one column per
// bank (header = bank name). Cell values: Active / Suspended / Not Applied
// (case-insensitive). Not Applied and blank cells are skipped entirely --
// no bank account row is created for them.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Status = "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";

function parseStatus(raw: string): Status | null | undefined {
  const v = raw.trim().toLowerCase();
  if (v === "") return null; // blank cell -- skip, not an error
  if (v === "active") return "ACTIVE";
  if (v === "suspended") return "SUSPENDED";
  if (v === "not applied" || v === "n/a" || v === "na") return "NOT_APPLIED";
  return undefined; // unrecognized -- caller reports and skips
}

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

  const raw = fs.readFileSync(csvPath, "utf8");
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (records.length === 0) {
    console.error("No rows found in CSV.");
    process.exit(1);
  }

  const headers = Object.keys(records[0]);
  const companyCol = headers.find((h) => h.toLowerCase() === "company name");
  const behalfCol = headers.find((h) => h.toLowerCase() === "behalf of");
  if (!companyCol) {
    console.error('Missing a "Company Name" column.');
    process.exit(1);
  }
  const bankCols = headers.filter((h) => h !== companyCol && h !== behalfCol);
  if (bankCols.length === 0) {
    console.error("No bank columns found (expected columns after Company Name / Behalf Of).");
    process.exit(1);
  }

  console.log(`Found ${records.length} row(s), ${bankCols.length} bank column(s): ${bankCols.join(", ")}\n`);

  const [allEmployees, allCompanies, allBankAccounts] = await Promise.all([
    prisma.employee.findMany(),
    prisma.company.findMany(),
    prisma.bankAccount.findMany(),
  ]);

  const unmatchedBehalfOf = new Set<string>();
  const notes: string[] = [];
  let companiesCreated = 0;
  let companiesUpdated = 0;
  let banksCreated = 0;
  let banksUpdated = 0;
  let banksSkippedNotApplied = 0;

  for (const row of records) {
    const companyName = row[companyCol]?.trim();
    if (!companyName) continue;

    const behalfOfName = behalfCol ? row[behalfCol]?.trim() : "";
    let employeePartnerId: string | null = null;
    if (behalfOfName) {
      const employee = allEmployees.find(
        (e) => e.name.trim().toLowerCase() === behalfOfName.toLowerCase()
      );
      if (employee) {
        employeePartnerId = employee.id;
        if (!employee.isEmployeePartner) {
          notes.push(
            `  NOTE: ${companyName} -> "${behalfOfName}" found but not flagged "Is Employee Partner" -- commission won't calculate until you flag them in Employees.`
          );
        }
      } else {
        unmatchedBehalfOf.add(behalfOfName);
      }
    }

    let company = allCompanies.find(
      (c) => c.name.trim().toLowerCase() === companyName.toLowerCase()
    );
    if (!company) {
      company = await prisma.company.create({
        data: { name: companyName, employeePartnerId },
      });
      allCompanies.push(company);
      companiesCreated++;
      console.log(`Created company: ${companyName}`);
    } else if (employeePartnerId && company.employeePartnerId !== employeePartnerId) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { employeePartnerId },
      });
      companiesUpdated++;
      console.log(`Updated ${companyName}'s Employee Partner -> ${behalfOfName}`);
    }

    for (const bankCol of bankCols) {
      const status = parseStatus(row[bankCol] ?? "");
      if (status === undefined) {
        notes.push(
          `  WARNING: ${companyName} / ${bankCol}: unrecognized value "${row[bankCol]}" -- skipped.`
        );
        continue;
      }
      if (status === null || status === "NOT_APPLIED") {
        if (status === "NOT_APPLIED") banksSkippedNotApplied++;
        continue;
      }

      // Match an existing row for this company+bank: prefer one already
      // linked to this company, else fall back to the legacy pattern of a
      // manually-created row named after the company (pre-dates this field).
      const existing = allBankAccounts.find(
        (b) =>
          (b.bankName ?? "").trim().toLowerCase() === bankCol.toLowerCase() &&
          (b.companyId === company!.id ||
            (b.companyId === null && b.name.trim().toLowerCase() === companyName.toLowerCase()))
      );

      const desiredName = `${companyName} — ${bankCol}`;

      if (existing) {
        await prisma.bankAccount.update({
          where: { id: existing.id },
          data: { companyId: company.id, status, name: desiredName, bankName: bankCol },
        });
        existing.companyId = company.id;
        existing.status = status;
        existing.name = desiredName;
        banksUpdated++;
        console.log(`  Updated ${desiredName}: ${status}`);
      } else {
        const created = await prisma.bankAccount.create({
          data: {
            name: desiredName,
            accountType: "BANK",
            bankName: bankCol,
            currency: "USD",
            companyId: company.id,
            status,
            active: true,
          },
        });
        allBankAccounts.push(created);
        banksCreated++;
        console.log(`  Created ${desiredName}: ${status}`);
      }
    }
  }

  console.log(
    `\n=== Summary: ${companiesCreated} companies created, ${companiesUpdated} updated | ${banksCreated} bank accounts created, ${banksUpdated} updated, ${banksSkippedNotApplied} "Not Applied" skipped ===`
  );

  if (notes.length > 0) {
    console.log("\n=== Notes ===");
    console.log(notes.join("\n"));
  }

  if (unmatchedBehalfOf.size > 0) {
    console.log('\n=== "Behalf Of" names not found in Employees -- add these first, then re-run ===');
    for (const name of unmatchedBehalfOf) console.log(`  - ${name}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
