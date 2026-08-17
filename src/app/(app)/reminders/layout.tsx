import { requireRole } from "@/lib/rbac";

export default async function RemindersLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
