import { requireRole } from "@/lib/rbac";

export default async function PartnerLedgerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
