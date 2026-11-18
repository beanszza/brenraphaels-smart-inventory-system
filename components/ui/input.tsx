import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-control border border-input bg-surface px-3 py-2 type-body text-ink transition-colors file:border-0 file:bg-transparent file:type-body file:font-medium file:text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
