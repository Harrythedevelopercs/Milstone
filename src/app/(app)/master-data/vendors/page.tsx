import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { VendorsClient } from "./vendors-client";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: { subscriptions: { orderBy: { name: "asc" } } },
  });

  const rows = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    phone: v.phone,
    status: v.status,
    subscriptions: v.subscriptions.map((s) => ({
      id: s.id,
      name: s.name,
      amount: s.amount.toString(),
      billingCycle: s.billingCycle,
      nextBillingDate: s.nextBillingDate ? format(s.nextBillingDate, "yyyy-MM-dd") : null,
      status: s.status,
    })),
  }));

  return <VendorsClient rows={rows} />;
}
