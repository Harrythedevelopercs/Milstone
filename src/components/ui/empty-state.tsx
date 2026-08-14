import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 py-10 text-center", className)}>
      <Icon className="size-8 text-muted-foreground/35" strokeWidth={1.5} />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  );
}
