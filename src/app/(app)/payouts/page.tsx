import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PayoutsPage() {
  const payouts = await prisma.clientPayout.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      payoutMethod: { select: { name: true } },
      bankAccount: { select: { name: true } },
      _count: { select: { allocations: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Client Payouts</h1>
        <Link href="/payouts/new" className={buttonVariants({})}>
          New Payout
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Remittance Fee</TableHead>
              <TableHead>Fee Bearer</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No payouts yet.
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{format(p.payoutDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{p.client.name}</TableCell>
                  <TableCell>{p.payoutMethod.name}</TableCell>
                  <TableCell>{p.bankAccount.name}</TableCell>
                  <TableCell className="text-right">{p._count.allocations}</TableCell>
                  <TableCell className="text-right">{p.amountPaid.toString()}</TableCell>
                  <TableCell className="text-right">{p.remittanceFee.toString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.feeBearer}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
