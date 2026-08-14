import { requireRole } from "@/lib/rbac";

export default async function SettlementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
