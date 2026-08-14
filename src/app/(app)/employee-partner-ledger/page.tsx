import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";

export default async function EmployeePartnerLedgerPage() {
  const [employees, balances] = await Promise.all([
    prisma.employee.findMany({ where: { isEmployeePartner: true }, orderBy: { name: "asc" } }),
    prisma.employeePartnerLedger.groupBy({ by: ["employeeId"], _sum: { amount: true } }),
  ]);

  const balanceByEmployee = new Map(balances.map((b) => [b.employeeId, b._sum.amount]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Employee Partner Ledger</h1>
        <p className="text-sm text-muted-foreground">
          10% monthly commission on eligible FP revenue through each employee&apos;s merchants.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Balance Owed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <EmptyTableRow colSpan={2} message="No employee partners yet." />
            ) : (
              employees.map((e) => {
                const balance = balanceByEmployee.get(e.id);
                const value = balance ? Number(balance) : 0;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/employee-partner-ledger/${e.id}`} className="hover:underline">
                        {e.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">{value.toFixed(2)}</TableCell>
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
