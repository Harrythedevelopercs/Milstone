import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PartnerLedgerPage() {
  const [partners, entries] = await Promise.all([
    prisma.partner.findMany({ orderBy: { name: "asc" } }),
    prisma.partnerLedger.findMany({ select: { partnerId: true, amount: true, kind: true } }),
  ]);

  const byPartner = new Map<string, { accrued: number; paid: number; balance: number }>();
  for (const e of entries) {
    const amt = Number(e.amount);
    const cur = byPartner.get(e.partnerId) ?? { accrued: 0, paid: 0, balance: 0 };
    cur.balance += amt;
    if (e.kind === "PROFIT_ENTITLEMENT") cur.accrued += amt;
    if (e.kind === "DRAWING") cur.paid += Math.abs(amt);
    byPartner.set(e.partnerId, cur);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Partner Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Accrued profit entitlement carries forward as a liability until drawn. Negative = over-drawn.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead className="text-right">Profit Share %</TableHead>
              <TableHead className="text-right">Accrued (all-time)</TableHead>
              <TableHead className="text-right">Drawn (all-time)</TableHead>
              <TableHead className="text-right">Owed Now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p) => {
              const stats = byPartner.get(p.id) ?? { accrued: 0, paid: 0, balance: 0 };
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/partner-ledger/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{p.profitSharePercent.toString()}%</TableCell>
                  <TableCell className="text-right">{stats.accrued.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{stats.paid.toFixed(2)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${stats.balance < 0 ? "text-destructive" : ""}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {stats.balance.toFixed(2)}
                      {stats.balance > 0 && <ToneBadge tone="warning">Owed</ToneBadge>}
                    </span>
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
