import { prisma } from "@/lib/prisma";

// The rate period covering `transactionDate` for this client+method. A later
// pricing change never affects this: effectiveTo on the old period is only
// ever set going forward from the change date, so past transactions keep
// resolving to the period they actually fell in.
export async function lookupClientRate(
  clientId: string,
  paymentMethodId: string,
  transactionDate: Date
) {
  return prisma.clientRateHistory.findFirst({
    where: {
      clientId,
      paymentMethodId,
      effectiveFrom: { lte: transactionDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: transactionDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function lookupMerchantFeeRule(merchantId: string, paymentMethodId: string) {
  return prisma.merchantFeeRule.findUnique({
    where: { merchantId_paymentMethodId: { merchantId, paymentMethodId } },
  });
}
