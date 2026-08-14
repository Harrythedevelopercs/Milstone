import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Client-facing statement: no internal source types, no FP fee/rate detail,
// no links back to internal records -- just what the client is owed/owes
// and why, in plain language.
export default async function ClientExternalStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const entries = await prisma.clientLedger.findMany({
    where: { clientId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  const rows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: number }>>(
    (acc, e) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      acc.push({ ...e, runningBalance: previous + Number(e.amount) });
      return acc;
    },
    []
  );
  const balance = rows.length > 0 ? rows[rows.length - 1].runningBalance : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-8 print:border-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statement of Account</h1>
          <p className="text-sm text-muted-foreground">{client.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">As of {format(new Date(), "yyyy-MM-dd")}</p>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {balance >= 0 ? "Balance due to you" : "Balance you owe FoundaPay"}
        </p>
        <p className="text-3xl font-semibold">{Math.abs(balance).toFixed(2)}</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                No activity yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                <TableCell>{clientFriendlyDescription(r.sourceType)}</TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">{r.runningBalance.toFixed(2)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function clientFriendlyDescription(sourceType: string): string {
  switch (sourceType) {
    case "TRANSACTION":
      return "Transaction settlement";
    case "PAYOUT":
      return "Payout";
    case "THIRD_PARTY_SETTLEMENT":
      return "Local settlement";
    case "PRODUCT_SERVICE_SALE":
      return "Service charge";
    case "ADJUSTMENT":
      return "Adjustment";
    case "RCV":
      return "Refund/Chargeback";
    default:
      return "Account activity";
  }
}
