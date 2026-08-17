"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { companySchema } from "./schema";

export async function createCompany(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const company = await prisma.company.create({
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      employeePartnerId: parsed.data.employeePartnerId || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "Company",
    entityId: company.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(company)),
  });
  revalidatePath("/master-data/companies");
  return { ok: true };
}

export async function updateCompany(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.company.findUnique({ where: { id } });
  const company = await prisma.company.update({
    where: { id },
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      employeePartnerId: parsed.data.employeePartnerId || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "Company",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(company)),
  });
  revalidatePath("/master-data/companies");
  return { ok: true };
}

export async function setCompanyStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const company = await prisma.company.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "Company",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(company)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/companies");
  return { ok: true };
}
