import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { TransactionStatusBadge } from "@/components/transactions/status-badge";
import { SubmitForm } from "./submit-form";

export default async function SubmitPage() {
  const user = await requireUser();

  const [clients, merchants, paymentMethods, mySubmissions] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        client: { select: { name: true } },
        merchant: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SubmitForm clients={clients} merchants={merchants} paymentMethods={paymentMethods} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your submissions</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewer note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mySubmissions.length === 0 ? (
                <EmptyTableRow colSpan={7} message="You haven't submitted anything yet." />
              ) : (
                mySubmissions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell>{format(t.transactionDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell>{t.client.name}</TableCell>
                    <TableCell>{t.merchant.name}</TableCell>
                    <TableCell className="text-right">{t.grossAmount.toString()}</TableCell>
                    <TableCell>
                      <TransactionStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {t.reviewNotes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
