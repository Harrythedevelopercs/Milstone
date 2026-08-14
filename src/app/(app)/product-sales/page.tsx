import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductSalesPage() {
  const sales = await prisma.productServiceSale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      productService: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Product & Service Sales</h1>
        <Link href="/product-sales/new" className={buttonVariants({})}>
          New Sale
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product/Service</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">COGS</TableHead>
              <TableHead className="text-right">Gross Profit</TableHead>
              <TableHead>Deducted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No sales yet.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{format(s.saleDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{s.productService.name}</TableCell>
                  <TableCell>{s.client?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{s.quantity}</TableCell>
                  <TableCell className="text-right">{s.totalRevenue.toString()}</TableCell>
                  <TableCell className="text-right">{s.totalCost.toString()}</TableCell>
                  <TableCell className="text-right font-medium">
                    {(Number(s.totalRevenue) - Number(s.totalCost)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {s.deductFromClientBalance ? <Badge>Yes</Badge> : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
