import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PartnerLedgerPage() {
  const [partners, balances] = await Promise.all([
    prisma.partner.findMany({ orderBy: { name: "asc" } }),
    prisma.partnerLedger.groupBy({ by: ["partnerId"], _sum: { amount: true } }),
  ]);

  const balanceByPartner = new Map(balances.map((b) => [b.partnerId, b._sum.amount]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Partner Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Accumulated equity: profit entitlements minus drawings. Negative = over-drawn, carried forward.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead className="text-right">Profit Share %</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p) => {
              const balance = balanceByPartner.get(p.id);
              const value = balance ? Number(balance) : 0;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/partner-ledger/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{p.profitSharePercent.toString()}%</TableCell>
                  <TableCell
                    className={`text-right font-medium ${value < 0 ? "text-destructive" : ""}`}
                  >
                    {value.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
