import { prisma } from "@/lib/prisma";

// Once a month is CLOSED, nothing may post into it -- a September chargeback
// on an August transaction still lands in September's own accountingMonth
// (brief section 6: "Aug stays closed even if a chargeback hits in Sept").
// Every action that writes a ledger row, transaction, or other posted
// record for a given accountingMonth must call this first.
export async function assertMonthOpen(accountingMonth: string): Promise<string | null> {
  const monthClose = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  if (monthClose?.status === "CLOSED") {
    return `${accountingMonth} is closed. An Owner must reopen it before posting to that month.`;
  }
  return null;
}
