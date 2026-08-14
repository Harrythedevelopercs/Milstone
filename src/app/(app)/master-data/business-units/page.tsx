import { prisma } from "@/lib/prisma";
import { SimpleLookupCrud } from "@/components/master-data/simple-lookup-crud";
import {
  createBusinessUnit,
  updateBusinessUnit,
  setBusinessUnitStatus,
} from "./actions";

export default async function BusinessUnitsPage() {
  const rows = await prisma.businessUnit.findMany({ orderBy: { name: "asc" } });

  return (
    <SimpleLookupCrud
      entityLabel="Business Unit"
      rows={rows}
      createAction={createBusinessUnit}
      updateAction={updateBusinessUnit}
      setStatusAction={setBusinessUnitStatus}
    />
  );
}
