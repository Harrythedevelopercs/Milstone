import { requireUser } from "@/lib/rbac";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canSeeMasterData = user.role === "OWNER" || user.role === "ACCOUNTANT";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6">
        <AppNav canSeeMasterData={canSeeMasterData} isEmployee={user.role === "EMPLOYEE"} />
        <UserMenu name={user.name} role={user.role} />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
