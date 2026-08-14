import { parse } from "csv-parse/sync";
import type { PrismaClient } from "@/generated/prisma/client";

// Shared by the CLI script (prisma/scripts/import-company-banks.ts) and the
// in-app "Import from CSV" button on the Bank Accounts screen, so both paths
// behave identically. Re-runnable: matches companies/bank accounts by name
// each time rather than tracking import IDs, so it only ever creates or
// updates, never duplicates.
//
// Expected CSV columns: "Company Name", "Behalf Of", then one column per
// bank (header = bank name). Cell values: Active / Suspended / Not Applied
// (case-insensitive). Not Applied and blank cells are skipped entirely --
// no bank account row is created for them.

export type BankAccountStatus = "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";

export type CompanyBanksImportResult = {
  rowCount: number;
  bankColumns: string[];
  companiesCreated: number;
  companiesUpdated: number;
  banksCreated: number;
  banksUpdated: number;
  banksSkippedNotApplied: number;
  log: string[];
  notes: string[];
  unmatchedBehalfOf: string[];
};

export type CompanyBanksImportOutcome = { ok: true; result: CompanyBanksImportResult } | { ok: false; error: string };

function parseStatus(raw: string): BankAccountStatus | null | undefined {
  const v = raw.trim().toLowerCase();
  if (v === "") return null; // blank cell -- skip, not an error
  if (v === "active") return "ACTIVE";
  if (v === "suspended") return "SUSPENDED";
  if (v === "not applied" || v === "n/a" || v === "na") return "NOT_APPLIED";
  return undefined; // unrecognized -- caller reports and skips
}

export async function importCompanyBanks(
  prisma: PrismaClient,
  csvText: string
): Promise<CompanyBanksImportOutcome> {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (e) {
    return { ok: false, error: `Could not parse CSV: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (records.length === 0) {
    return { ok: false, error: "No rows found in CSV." };
  }

  const headers = Object.keys(records[0]);
  const companyCol = headers.find((h) => h.toLowerCase() === "company name");
  const behalfCol = headers.find((h) => h.toLowerCase() === "behalf of");
  if (!companyCol) {
    return { ok: false, error: 'Missing a "Company Name" column.' };
  }
  const bankCols = headers.filter((h) => h !== companyCol && h !== behalfCol);
  if (bankCols.length === 0) {
    return { ok: false, error: "No bank columns found (expected columns after Company Name / Behalf Of)." };
  }

  const log: string[] = [];
  const notes: string[] = [];
  const unmatchedBehalfOf = new Set<string>();
  let companiesCreated = 0;
  let companiesUpdated = 0;
  let banksCreated = 0;
  let banksUpdated = 0;
  let banksSkippedNotApplied = 0;

  const [allEmployees, allCompanies, allBankAccounts] = await Promise.all([
    prisma.employee.findMany(),
    prisma.company.findMany(),
    prisma.bankAccount.findMany(),
  ]);

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
            `${companyName} -> "${behalfOfName}" found but not flagged "Is Employee Partner" -- commission won't calculate until you flag them in Employees.`
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
      log.push(`Created company: ${companyName}`);
    } else if (employeePartnerId && company.employeePartnerId !== employeePartnerId) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { employeePartnerId },
      });
      companiesUpdated++;
      log.push(`Updated ${companyName}'s Employee Partner -> ${behalfOfName}`);
    }

    for (const bankCol of bankCols) {
      const status = parseStatus(row[bankCol] ?? "");
      if (status === undefined) {
        notes.push(`${companyName} / ${bankCol}: unrecognized value "${row[bankCol]}" -- skipped.`);
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
        log.push(`Updated ${desiredName}: ${status}`);
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
        log.push(`Created ${desiredName}: ${status}`);
      }
    }
  }

  return {
    ok: true,
    result: {
      rowCount: records.length,
      bankColumns: bankCols,
      companiesCreated,
      companiesUpdated,
      banksCreated,
      banksUpdated,
      banksSkippedNotApplied,
      log,
      notes,
      unmatchedBehalfOf: Array.from(unmatchedBehalfOf),
    },
  };
}
