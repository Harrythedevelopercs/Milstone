import { prisma } from "@/lib/prisma";
import { PartnersClient } from "./partners-client";

export default async function PartnersPage() {
  const [partners, ownerUsers] = await Promise.all([
    prisma.partner.findMany({
      orderBy: { name: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: "OWNER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const rows = partners.map((p) => ({
    id: p.id,
    name: p.name,
    profitSharePercent: p.profitSharePercent.toString(),
    status: p.status,
    userId: p.userId,
    user: p.user,
  }));

  return <PartnersClient rows={rows} ownerUsers={ownerUsers} />;
}
