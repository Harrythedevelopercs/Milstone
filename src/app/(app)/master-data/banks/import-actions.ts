"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { importCompanyBanks, type CompanyBanksImportResult } from "@/lib/imports/company-banks";

export type ImportCompanyBanksActionResult =
  | { ok: true; result: CompanyBanksImportResult }
  | { ok: false; error: string };

export async function importCompanyBanksAction(
  formData: FormData
): Promise<ImportCompanyBanksActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }

  const csvText = await file.text();
  const outcome = await importCompanyBanks(prisma, csvText);
  if (!outcome.ok) return outcome;

  revalidatePath("/master-data/banks");
  revalidatePath("/master-data/companies");
  return outcome;
}
