"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { reconciliationSchema } from "./schema";

export async function recordBankReconciliation(
  bankAccountId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = reconciliationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const account = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    include: { ledgerEntries: { select: { amount: true } } },
  });
  if (!account) return { ok: false, error: "Bank account not found." };

  const bookBalance = account.ledgerEntries.reduce(
    (sum, e) => sum.plus(e.amount),
    new Decimal(account.openingBalance)
  );
  const actualBalance = new Decimal(d.actualBalance);
  const differenceAmount = actualBalance.minus(bookBalance);

  await prisma.$transaction(async (tx) => {
    const record = await tx.bankReconciliation.create({
      data: {
        bankAccountId,
        asOfDate: new Date(d.asOfDate),
        bookBalance: bookBalance.toFixed(2),
        actualBalance: actualBalance.toFixed(2),
        differenceAmount: differenceAmount.toFixed(2),
        notes: d.notes || null,
        createdById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "BankReconciliation",
      entityId: record.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(record)),
    });
  });

  revalidatePath(`/cash-position/${bankAccountId}`);
  return { ok: true };
}
