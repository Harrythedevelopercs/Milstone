import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TransfersPage() {
  const transfers = await prisma.internalTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromBankAccount: { select: { name: true } },
      toBankAccount: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Internal Transfers</h1>
        <Link href="/transfers/new" className={buttonVariants({})}>
          New Transfer
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No transfers yet.
                </TableCell>
              </TableRow>
            ) : (
              transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{format(t.transferDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{t.fromBankAccount.name}</TableCell>
                  <TableCell>{t.toBankAccount.name}</TableCell>
                  <TableCell className="text-right">{t.amount.toString()}</TableCell>
                  <TableCell className="text-right">{t.feeAmount.toString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
