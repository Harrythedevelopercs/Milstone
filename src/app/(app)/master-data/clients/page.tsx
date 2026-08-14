import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ClientsClient } from "./clients-client";

export default async function ClientsPage() {
  const [clients, paymentMethods] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        rateHistory: {
          orderBy: { effectiveFrom: "desc" },
          include: { paymentMethod: { select: { name: true } } },
        },
      },
    }),
    prisma.paymentMethod.findMany({
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
    rateHistory: c.rateHistory.map((r) => ({
      id: r.id,
      effectiveFrom: format(r.effectiveFrom, "yyyy-MM-dd"),
      effectiveTo: r.effectiveTo ? format(r.effectiveTo, "yyyy-MM-dd") : null,
      ratePercent: r.ratePercent.toString(),
      feeBasis: r.feeBasis,
      paymentMethod: r.paymentMethod,
    })),
  }));

  return <ClientsClient rows={rows} paymentMethods={paymentMethods} />;
}
