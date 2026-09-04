import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { MarkSettledAction } from "@/components/ui/mark-settled-action";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { markInternalTransferSettled } from "./actions";

export default async function TransfersPage() {
  const transfers = await prisma.internalTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromBankAccount: { select: { name: true } },
      toBankAccount: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Internal Transfers</h1>
        <Link href="/transfers/new" className={buttonVariants({})}>
          + New Transfer
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
              <TableHead>Bearer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.length === 0 ? (
              <EmptyTableRow colSpan={9} message="No transfers yet." />
            ) : (
              transfers.map((t) => {
                const pending = t.settlementStatus === "PENDING";
                return (
                  <TableRow key={t.id} className={pending ? NEEDS_ATTENTION_ROW_CLASS : undefined}>
                    <TableCell>{format(t.transferDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell>{t.fromBankAccount.name}</TableCell>
                    <TableCell>{t.toBankAccount.name}</TableCell>
                    <TableCell className="text-right">{t.amount.toString()}</TableCell>
                    <TableCell className="text-right">{t.feeAmount.toString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.feeBearer === "CLIENT" ? `Client (${t.client?.name ?? "—"})` : "FoundaPay"}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {t.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={pending ? "warning" : "success"}>
                        {pending ? "Pending" : "Settled"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pending && (
                        <MarkSettledAction id={t.id} action={markInternalTransferSettled} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
