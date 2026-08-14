"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { bonusAllocationSchema } from "./schema";

export async function allocateBonusPool(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = bonusAllocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { id: d.employeeId } });
  if (!employee || employee.status !== "ACTIVE") {
    return { ok: false, error: "Employee not found or inactive." };
  }

  const poolTotal = await prisma.bonusPoolLedger.aggregate({ _sum: { amount: true } });
  const remaining = new Decimal(poolTotal._sum.amount ?? 0);
  const amount = new Decimal(d.amount);
  if (amount.greaterThan(remaining)) {
    return { ok: false, error: `Amount exceeds the remaining pool balance (${remaining.toFixed(2)}).` };
  }

  const allocationDate = new Date(d.allocationDate);
  if (Number.isNaN(allocationDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(allocationDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const entry = await tx.bonusPoolLedger.create({
      data: {
        entryDate: allocationDate,
        accountingMonth,
        amount: amount.negated().toFixed(2),
        sourceType: "MANUAL",
        sourceId: d.employeeId,
        allocatedToEmployeeId: d.employeeId,
        allocationDate,
        description: d.notes || `Allocated to ${employee.name}`,
        createdById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "BonusPoolLedger",
      entityId: entry.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(entry)),
    });
  });

  revalidatePath("/bonus-pool");
  return { ok: true };
}
