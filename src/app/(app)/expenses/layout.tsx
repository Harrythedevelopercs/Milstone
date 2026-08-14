import { requireRole } from "@/lib/rbac";

export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
