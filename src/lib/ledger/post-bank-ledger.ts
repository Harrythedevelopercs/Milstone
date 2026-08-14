import type { Prisma } from "@/generated/prisma/client";

// Every cash-touching action (settlement deposit, payout, third-party
// reimbursement) posts one row here so Cash Position (build step 7) has
// real data to show instead of starting from zero. usdValue mirrors amount
// for now; non-USD accounts get a real manual USD value once step 7 adds
// that input.
export async function postBankLedgerEntry(
  tx: Prisma.TransactionClient,
  params: {
    bankAccountId: string;
    amount: Prisma.Decimal | string;
    entryDate: Date;
    accountingMonth: string;
    sourceType:
      | "SETTLEMENT_BATCH"
      | "PAYOUT"
      | "THIRD_PARTY_SETTLEMENT"
      | "EXPENSE"
      | "INTERNAL_TRANSFER"
      | "MANUAL"
      | "ADJUSTMENT";
    sourceId: string;
    description: string;
    createdById: string;
  }
) {
  await tx.bankLedger.create({
    data: {
      bankAccountId: params.bankAccountId,
      entryDate: params.entryDate,
      accountingMonth: params.accountingMonth,
      amount: params.amount,
      usdValue: params.amount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description,
      createdById: params.createdById,
    },
  });
}
