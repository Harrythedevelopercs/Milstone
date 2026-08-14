"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult } from "@/lib/action-result";
import { companySchema } from "./schema";

export async function createCompany(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.company.create({
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      employeePartnerId: parsed.data.employeePartnerId || null,
    },
  });
  revalidatePath("/master-data/companies");
  return { ok: true };
}

export async function updateCompany(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.company.update({
    where: { id },
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      employeePartnerId: parsed.data.employeePartnerId || null,
    },
  });
  revalidatePath("/master-data/companies");
  return { ok: true };
}

export async function setCompanyStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.company.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/companies");
  return { ok: true };
}
