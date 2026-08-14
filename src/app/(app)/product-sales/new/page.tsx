import { prisma } from "@/lib/prisma";
import { SaleForm } from "./sale-form";

export default async function NewProductSalePage() {
  const [products, clients, businessUnits] = await Promise.all([
    prisma.productService.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true, sellPrice: true },
    }),
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.businessUnit.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <SaleForm
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          cost: p.cost.toString(),
          sellPrice: p.sellPrice.toString(),
        }))}
        clients={clients}
        businessUnits={businessUnits}
      />
    </div>
  );
}
