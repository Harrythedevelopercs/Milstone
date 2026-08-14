import { requireRole } from "@/lib/rbac";

export default async function ThirdPartyLayout({ children }: { children: React.ReactNode }) {
  await requireRole("OWNER", "ACCOUNTANT");
  return <>{children}</>;
}
