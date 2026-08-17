import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
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
  const [employees, entries] = await Promise.all([
    prisma.employee.findMany({ where: { isEmployeePartner: true }, orderBy: { name: "asc" } }),
    prisma.employeePartnerLedger.findMany({ select: { employeeId: true, amount: true, kind: true } }),
  ]);

  const byEmployee = new Map<string, { accrued: number; paid: number; balance: number }>();
  for (const e of entries) {
    const amt = Number(e.amount);
    const cur = byEmployee.get(e.employeeId) ?? { accrued: 0, paid: 0, balance: 0 };
    cur.balance += amt;
    if (e.kind === "COMMISSION") cur.accrued += amt;
    if (e.kind === "PAYMENT") cur.paid += Math.abs(amt);
    byEmployee.set(e.employeeId, cur);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Employee Partner Ledger</h1>
        <p className="text-sm text-muted-foreground">
          10% monthly commission on eligible FP revenue through each employee&apos;s merchants.
          Unpaid commission carries forward as a liability until paid.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Accrued (all-time)</TableHead>
              <TableHead className="text-right">Paid (all-time)</TableHead>
              <TableHead className="text-right">Owed Now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <EmptyTableRow colSpan={4} message="No employee partners yet." />
            ) : (
              employees.map((e) => {
                const stats = byEmployee.get(e.id) ?? { accrued: 0, paid: 0, balance: 0 };
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/employee-partner-ledger/${e.id}`} className="hover:underline">
                        {e.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{stats.accrued.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{stats.paid.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-2 font-medium">
                        {stats.balance.toFixed(2)}
                        {stats.balance > 0 && <ToneBadge tone="warning">Owed</ToneBadge>}
                      </span>
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
