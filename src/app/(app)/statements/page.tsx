import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StatementsPage() {
  const merchants = await prisma.merchant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Statements</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Standard Financial Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/statements/income-statement" className="block hover:underline">
              Income Statement (P&amp;L)
            </Link>
            <Link href="/statements/balance-sheet" className="block hover:underline">
              Balance Sheet
            </Link>
            <Link href="/statements/cash-flow" className="block hover:underline">
              Cash Flow
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss (legacy views)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/statements/consolidated-pnl" className="block hover:underline">
              Consolidated P&L
            </Link>
            <Link href="/statements/company-pnl" className="block hover:underline">
              Company P&L
            </Link>
            <Link href="/statements/business-unit-pnl" className="block hover:underline">
              Business Unit P&L
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Merchant Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {merchants.map((m) => (
              <Link key={m.id} href={`/statements/merchant/${m.id}`} className="block hover:underline">
                {m.name}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Client, Bank, Employee Partner, and Partner statements are their respective ledger
              pages — open a client, bank account, employee partner, or partner to see their
              full dated statement with running balance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
