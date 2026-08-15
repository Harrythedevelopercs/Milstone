import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ attention?: string }>;
}) {
  const { attention } = await searchParams;
  const needsAttentionOnly = attention === "1";

  const [clients, balances] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.clientLedger.groupBy({ by: ["clientId"], _sum: { amount: true } }),
  ]);

  const balanceByClient = new Map(balances.map((b) => [b.clientId, b._sum.amount]));
  const rows = clients
    .map((c) => ({ ...c, value: Number(balanceByClient.get(c.id) ?? 0) }))
    .filter((c) => !needsAttentionOnly || c.value < 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Client Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Positive balance = FoundaPay owes the client. Negative = the client owes FoundaPay.
          </p>
        </div>
        <Link
          href={{ pathname: "/client-ledger", query: needsAttentionOnly ? {} : { attention: "1" } }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {needsAttentionOnly ? "Show all" : "Needs attention only (negative balances)"}
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className={c.value < 0 ? NEEDS_ATTENTION_ROW_CLASS : undefined}>
                <TableCell>
                  <Link href={`/client-ledger/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    c.value > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : c.value < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {c.value.toFixed(2)}
                    {c.value < 0 && <ToneBadge tone="danger">Advanced</ToneBadge>}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
