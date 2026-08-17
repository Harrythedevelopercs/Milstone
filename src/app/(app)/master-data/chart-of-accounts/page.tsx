import { prisma } from "@/lib/prisma";
import { ChartOfAccountsClient } from "./chart-of-accounts-client";

export default async function ChartOfAccountsPage() {
  const rows = await prisma.account.findMany({ orderBy: { code: "asc" } });
  return <ChartOfAccountsClient rows={rows} />;
}
