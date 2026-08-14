import { prisma } from "@/lib/prisma";
import { SettlementPartiesClient } from "./settlement-parties-client";

export default async function SettlementPartiesPage() {
  const rows = await prisma.settlementParty.findMany({ orderBy: { name: "asc" } });
  return <SettlementPartiesClient rows={rows} />;
}
