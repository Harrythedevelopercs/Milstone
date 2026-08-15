import { prisma } from "@/lib/prisma";
import { PaymentMethodsClient } from "./payment-methods-client";

export default async function PaymentMethodsPage() {
  const rows = await prisma.paymentMethod.findMany({ orderBy: { name: "asc" } });

  return <PaymentMethodsClient rows={rows} />;
}
