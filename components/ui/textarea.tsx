import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-control border border-input bg-surface px-3 py-2 type-body text-ink transition-colors placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
