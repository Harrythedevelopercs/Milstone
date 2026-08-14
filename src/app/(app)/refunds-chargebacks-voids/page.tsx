import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";

const TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  REFUND: "secondary",
  CHARGEBACK: "destructive",
  VOID: "outline",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "secondary",
  RESOLVED: "default",
  DISPUTED: "destructive",
};

export default async function RefundsChargebacksVoidsPage() {
  const rows = await prisma.refundChargebackVoid.findMany({
    orderBy: { eventDate: "desc" },
    take: 200,
    include: {
      originalTransaction: {
        select: { id: true, grossAmount: true, fpFee: true, clientNetPayable: true, client: { select: { name: true, id: true } } },
      },
    },
  });

  const creators = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
    select: { id: true, name: true },
  });
  const creatorName = new Map(creators.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Refunds, Chargebacks & Voids</h1>
        <p className="text-sm text-muted-foreground">
          Every reversal is linked to its original transaction, which is left untouched. Refunds
          and chargebacks keep FoundaPay&apos;s fee as revenue; voids are excluded from revenue
          entirely.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Event Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Original Txn</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Original FP Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={11} message="No refunds, chargebacks, or voids yet." />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[r.type] ?? "outline"}>
                      {r.type.charAt(0) + r.type.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(r.eventDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href="/transactions" className="hover:underline">
                      {r.originalTransactionId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/client-ledger/${r.originalTransaction.client.id}`} className="hover:underline">
                      {r.originalTransaction.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.amount.toString()}</TableCell>
                  <TableCell className="text-right">{r.originalTransaction.fpFee.toString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.reasonCode ?? "—"}</TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                  <TableCell>{creatorName.get(r.createdById) ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
