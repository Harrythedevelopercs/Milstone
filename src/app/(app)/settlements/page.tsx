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

export default async function SettlementsPage() {
  const batches = await prisma.settlementBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      merchant: { select: { name: true } },
      bankAccount: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settlement Batches</h1>
        <Link href="/settlements/new" className={buttonVariants({})}>
          New Settlement Batch
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No settlement batches yet.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{format(b.depositDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{b.merchant.name}</TableCell>
                  <TableCell>{b.bankAccount.name}</TableCell>
                  <TableCell className="text-right">{b._count.transactions}</TableCell>
                  <TableCell className="text-right">{b.expectedAmount.toString()}</TableCell>
                  <TableCell className="text-right">{b.depositAmount.toString()}</TableCell>
                  <TableCell
                    className={`text-right ${
                      Number(b.differenceAmount) !== 0 ? "text-destructive font-medium" : ""
                    }`}
                  >
                    {b.differenceAmount.toString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === "RECONCILED" ? "default" : "destructive"}>
                      {b.status}
                    </Badge>
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
