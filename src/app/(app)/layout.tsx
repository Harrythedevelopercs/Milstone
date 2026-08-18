import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  // Employees get the same full nav as Owner/Accountant -- see rbac.ts.
  const canSeeMasterData = true;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6">
        <AppNav canSeeMasterData={canSeeMasterData} isEmployee={false} />
        <UserMenu name={user.name} role={user.role} />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
