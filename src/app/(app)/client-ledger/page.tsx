import Link from "next/link";
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

export default async function ClientLedgerPage() {
  const [clients, balances] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.clientLedger.groupBy({ by: ["clientId"], _sum: { amount: true } }),
  ]);

  const balanceByClient = new Map(balances.map((b) => [b.clientId, b._sum.amount]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Client Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Positive balance = FoundaPay owes the client. Negative = the client owes FoundaPay.
        </p>
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
            {clients.map((c) => {
              const balance = balanceByClient.get(c.id);
              const value = balance ? Number(balance) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/client-ledger/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      value > 0 ? "text-emerald-600" : value < 0 ? "text-destructive" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {value.toFixed(2)}
                      {value < 0 && <Badge variant="destructive">Advanced</Badge>}
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
