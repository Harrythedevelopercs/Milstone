import { format } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";

export function accountingMonthOf(date: Date): string {
  return format(date, "yyyy-MM");
}

// FP-YYYY-MM-000001, per-month sequence. Must run inside the same
// prisma.$transaction() as the Transaction row creation so the id and the
// row are committed atomically -- pass the transaction client, not `prisma`.
export async function nextTransactionId(
  tx: Prisma.TransactionClient,
  accountingMonth: string
): Promise<string> {
  const seq = await tx.transactionSequence.upsert({
    where: { accountingMonth },
    create: { accountingMonth, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const [year, month] = accountingMonth.split("-");
  return `FP-${year}-${month}-${String(seq.lastNumber).padStart(6, "0")}`;
}
