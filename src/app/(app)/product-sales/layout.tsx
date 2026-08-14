import { requireRole } from "@/lib/rbac";

export default async function ProductSalesLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
