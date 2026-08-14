import { prisma } from "@/lib/prisma";
import { ProductsServicesClient } from "./products-services-client";

export default async function ProductsServicesPage() {
  const items = await prisma.productService.findMany({ orderBy: { name: "asc" } });

  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    cost: i.cost.toString(),
    sellPrice: i.sellPrice.toString(),
    status: i.status,
  }));

  return <ProductsServicesClient rows={rows} />;
}
