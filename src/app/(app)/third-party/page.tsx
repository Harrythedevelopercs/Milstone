import Link from "next/link";
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

export default async function ThirdPartyPage() {
  const [parties, balances] = await Promise.all([
    prisma.settlementParty.findMany({ orderBy: { name: "asc" } }),
    prisma.thirdPartyLedger.groupBy({ by: ["settlementPartyId"], _sum: { amount: true } }),
  ]);

  const balanceByParty = new Map(balances.map((b) => [b.settlementPartyId, b._sum.amount]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Third-Party Settlements</h1>
          <p className="text-sm text-muted-foreground">
            Balance = what FoundaPay currently owes this party.
          </p>
        </div>
        <Link href="/third-party/new" className={buttonVariants({})}>
          New Settlement
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead className="text-right">Balance Owed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                  No settlement parties yet.
                </TableCell>
              </TableRow>
            ) : (
              parties.map((p) => {
                const balance = balanceByParty.get(p.id);
                const value = balance ? Number(balance) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/third-party/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${value > 0 ? "text-destructive" : ""}`}
                    >
                      {value.toFixed(2)}
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
