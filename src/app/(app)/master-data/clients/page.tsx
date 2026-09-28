import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ClientsClient } from "./clients-client";

export default async function ClientsPage() {
  const [clients, paymentMethods, referralPartners] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        rateHistory: {
          orderBy: { effectiveFrom: "desc" },
          include: {
            paymentMethod: { select: { name: true } },
            referralPartner: { select: { name: true } },
          },
        },
      },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.referralPartner.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    status: c.status,
    defaultReserveType: c.defaultReserveType,
    defaultReserveValue: c.defaultReserveValue?.toString() ?? null,
    defaultReserveDirection: c.defaultReserveDirection,
    defaultFeeBasis: c.defaultFeeBasis,
    defaultMerchantReserveBasis: c.defaultMerchantReserveBasis,
    rateHistory: c.rateHistory.map((r) => ({
      id: r.id,
      paymentMethodId: r.paymentMethodId,
      effectiveFrom: format(r.effectiveFrom, "yyyy-MM-dd"),
      effectiveTo: r.effectiveTo ? format(r.effectiveTo, "yyyy-MM-dd") : null,
      ratePercent: r.ratePercent.toString(),
      feeBasis: r.feeBasis,
      referralPartnerId: r.referralPartnerId,
      referralPartnerRatePercent: r.referralPartnerRatePercent?.toString() ?? null,
      paymentMethod: r.paymentMethod,
      referralPartner: r.referralPartner,
    })),
  }));

  return <ClientsClient rows={rows} paymentMethods={paymentMethods} referralPartners={referralPartners} />;
}
