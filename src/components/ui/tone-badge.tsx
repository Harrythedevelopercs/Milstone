import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { TONE_BADGE_CLASS, type StatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_BADGE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}
