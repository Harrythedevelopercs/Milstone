import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button, buttonVariants } from "@/components/ui/button";
import { logoutAction } from "@/app/(app)/actions";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "Employee",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ name, role }: { name?: string | null; role: string }) {
  const displayName = name || "Unknown";
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">{displayName}</span>
          <Badge variant="secondary" className="w-fit px-1.5 py-0 text-[10px]">
            {ROLE_LABEL[role] ?? role}
          </Badge>
        </div>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <Link href="/change-password" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Change Password
      </Link>
      <form action={logoutAction}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
