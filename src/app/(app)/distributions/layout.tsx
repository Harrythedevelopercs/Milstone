import { requireRole } from "@/lib/rbac";

export default async function DistributionsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
