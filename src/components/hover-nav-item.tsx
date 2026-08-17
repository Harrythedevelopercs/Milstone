"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavSubItem = { href: string; label: string };

const TRIGGER_CLASS =
  "flex items-center gap-1 border-b-2 pb-[18px] pt-[18px] text-sm outline-none transition-colors";
const TRIGGER_TONE = {
  active: "border-primary font-medium text-foreground",
  inactive: "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
};

// A top-nav item whose sub-pages show in a dropdown on hover (or keyboard
// focus, for accessibility) -- pure CSS group-hover, no JS state, so it
// can't get out of sync or flicker. `href` is optional: pass it when the
// section has its own landing page (e.g. Statements); omit it for a
// label-only trigger that exists purely to group its sub-items (e.g. Money).
export function HoverNavItem({
  label,
  href,
  active,
  items,
}: {
  label: string;
  href?: string;
  active: boolean;
  items: NavSubItem[];
}) {
  const triggerClass = cn(TRIGGER_CLASS, active ? TRIGGER_TONE.active : TRIGGER_TONE.inactive);

  return (
    <div className="group relative">
      {href ? (
        <Link href={href} className={triggerClass}>
          {label}
          <ChevronDown className="size-3 transition-transform duration-150 group-hover:rotate-180" aria-hidden="true" />
        </Link>
      ) : (
        <button type="button" className={cn(triggerClass, "cursor-default")}>
          {label}
          <ChevronDown className="size-3 transition-transform duration-150 group-hover:rotate-180" aria-hidden="true" />
        </button>
      )}
      <div
        className={cn(
          "invisible absolute left-0 top-full z-50 min-w-56 -translate-y-1 rounded-lg bg-popover p-1 text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-[opacity,transform] duration-150",
          "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
          "max-h-[70vh] overflow-y-auto"
        )}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
