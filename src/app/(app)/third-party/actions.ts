"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { thirdPartySettlementSchema } from "./schema";

export async function createThirdPartySettlement(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = thirdPartySettlementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const settlementParty = await prisma.settlementParty.findUnique({
    where: { id: d.settlementPartyId },
  });
  if (!settlementParty || settlementParty.status !== "ACTIVE") {
    return { ok: false, error: "Settlement party not found or inactive." };
  }

  const settlementDate = new Date(d.settlementDate);
  if (Number.isNaN(settlementDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(settlementDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };
  const amount = new Decimal(d.amount);

  if (d.direction === "CLIENT_PAYABLE_TO_THIRD_PARTY") {
    if (!d.clientId) return { ok: false, error: "Client is required for this direction." };
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client || client.status !== "ACTIVE") return { ok: false, error: "Client not found or inactive." };

    await prisma.$transaction(async (tx) => {
      const settlement = await tx.thirdPartySettlement.create({
        data: {
          settlementPartyId: d.settlementPartyId,
          clientId: d.clientId,
          direction: d.direction,
          amount: amount.toFixed(2),
          settlementDate,
          accountingMonth,
          notes: d.notes || null,
          createdById: user.id,
        },
      });

      await tx.clientLedger.create({
        data: {
          clientId: d.clientId!,
          entryDate: settlementDate,
          accountingMonth,
          amount: amount.negated().toFixed(2),
          sourceType: "THIRD_PARTY_SETTLEMENT",
          sourceId: settlement.id,
          description: `Paid via ${settlementParty.name}`,
          createdById: user.id,
        },
      });

      await tx.thirdPartyLedger.create({
        data: {
          settlementPartyId: d.settlementPartyId,
          entryDate: settlementDate,
          accountingMonth,
          amount: amount.toFixed(2),
          sourceType: "THIRD_PARTY_SETTLEMENT",
          sourceId: settlement.id,
          thirdPartySettlementId: settlement.id,
          description: `Paid ${client.name} on FoundaPay's behalf`,
          createdById: user.id,
        },
      });

      await writeAuditLog(tx, {
        entityType: "ThirdPartySettlement",
        entityId: settlement.id,
        action: "CREATE",
        performedById: user.id,
        afterSnapshot: JSON.parse(JSON.stringify(settlement)),
      });
    });
  } else {
    if (!d.bankAccountId) return { ok: false, error: "Bank account is required for this direction." };
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } });
    if (!bankAccount || !bankAccount.active) {
      return { ok: false, error: "Bank account not found or inactive." };
    }

    await prisma.$transaction(async (tx) => {
      const settlement = await tx.thirdPartySettlement.create({
        data: {
          settlementPartyId: d.settlementPartyId,
          bankAccountId: d.bankAccountId,
          direction: d.direction,
          amount: amount.toFixed(2),
          settlementDate,
          accountingMonth,
          notes: d.notes || null,
          createdById: user.id,
        },
      });

      await postBankLedgerEntry(tx, {
        bankAccountId: d.bankAccountId!,
        amount: amount.negated().toFixed(2),
        entryDate: settlementDate,
        accountingMonth,
        sourceType: "THIRD_PARTY_SETTLEMENT",
        sourceId: settlement.id,
        description: `Reimbursed ${settlementParty.name}`,
        createdById: user.id,
      });

      await tx.thirdPartyLedger.create({
        data: {
          settlementPartyId: d.settlementPartyId,
          entryDate: settlementDate,
          accountingMonth,
          amount: amount.negated().toFixed(2),
          sourceType: "THIRD_PARTY_SETTLEMENT",
          sourceId: settlement.id,
          thirdPartySettlementId: settlement.id,
          description: "Reimbursed from FoundaPay bank",
          createdById: user.id,
        },
      });

      await writeAuditLog(tx, {
        entityType: "ThirdPartySettlement",
        entityId: settlement.id,
        action: "CREATE",
        performedById: user.id,
        afterSnapshot: JSON.parse(JSON.stringify(settlement)),
      });
    });
  }

  revalidatePath("/third-party");
  revalidatePath("/client-ledger");
  return { ok: true };
}
