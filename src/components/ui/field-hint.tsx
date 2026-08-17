"use client"

import * as React from "react"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// A small "?" icon that shows an explanation of a form field on hover --
// attach via FormLabel's `hint` prop rather than using this directly in
// most cases.
export function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        tabIndex={-1}
        aria-label="Field help"
        className={cn(
          "inline-flex size-3.5 shrink-0 items-center justify-center align-middle text-muted-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:text-foreground",
          className
        )}
      >
        <HelpCircle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}
