import { prisma } from "@/lib/prisma";
import { SimpleLookupCrud } from "@/components/master-data/simple-lookup-crud";
import {
  createPaymentMethod,
  updatePaymentMethod,
  setPaymentMethodStatus,
} from "./actions";

export default async function PaymentMethodsPage() {
  const rows = await prisma.paymentMethod.findMany({ orderBy: { name: "asc" } });

  return (
    <SimpleLookupCrud
      entityLabel="Payment Method"
      rows={rows}
      createAction={createPaymentMethod}
      updateAction={updatePaymentMethod}
      setStatusAction={setPaymentMethodStatus}
    />
  );
}
