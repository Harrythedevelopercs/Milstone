import type { Prisma } from "@/generated/prisma/client";

// Posts what this approved transaction adds to what FoundaPay owes the
// client (brief section 5, "client position"). clientNetPayable already
// nets out the merchant reserve, FP's own fee/reserve, and (if the client
// bears it) the merchant fee -- so this single credit is the transaction's
// full contribution to the running balance. Reserve releases, payouts,
// refunds/chargebacks, remittance fees, product sales, and adjustments each
// post their own signed entries in later build steps; the balance is always
// just the sum of every ClientLedger row for that client.
export async function postClientLedgerForTransaction(
  tx: Prisma.TransactionClient,
  params: {
    transactionId: string;
    clientId: string;
    amount: Prisma.Decimal | string;
    entryDate: Date;
    accountingMonth: string;
    createdById: string;
  }
) {
  await tx.clientLedger.create({
    data: {
      clientId: params.clientId,
      entryDate: params.entryDate,
      accountingMonth: params.accountingMonth,
      amount: params.amount,
      sourceType: "TRANSACTION",
      sourceId: params.transactionId,
      transactionId: params.transactionId,
      description: `Transaction ${params.transactionId} approved`,
      createdById: params.createdById,
    },
  });
}
