import { prisma } from "@/lib/prisma";
import { SimpleLookupCrud } from "@/components/master-data/simple-lookup-crud";
import {
  createPayoutMethod,
  updatePayoutMethod,
  setPayoutMethodStatus,
} from "./actions";

export default async function PayoutMethodsPage() {
  const rows = await prisma.payoutMethod.findMany({ orderBy: { name: "asc" } });

  return (
    <SimpleLookupCrud
      entityLabel="Payout Method"
      rows={rows}
      createAction={createPayoutMethod}
      updateAction={updatePayoutMethod}
      setStatusAction={setPayoutMethodStatus}
    />
  );
}
