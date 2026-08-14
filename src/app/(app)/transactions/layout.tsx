import { requireRole } from "@/lib/rbac";

export default async function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
