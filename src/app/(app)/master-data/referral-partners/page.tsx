import { prisma } from "@/lib/prisma";
import { ReferralPartnersClient } from "./referral-partners-client";

export default async function ReferralPartnersPage() {
  const partners = await prisma.referralPartner.findMany({ orderBy: { name: "asc" } });
  const rows = partners.map((p) => ({ id: p.id, name: p.name, notes: p.notes, status: p.status }));
  return <ReferralPartnersClient rows={rows} />;
}
