"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavDropdown({
  label,
  items,
  active = false,
}: {
  label: string;
  items: { href: string; label: string }[];
  active?: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "border-b-2 pb-[18px] pt-[18px] text-sm outline-none transition-colors",
          active
            ? "border-primary font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
        )}
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
