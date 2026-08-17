import { requireRole } from "@/lib/rbac";

export default async function TransactionsBoardLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
