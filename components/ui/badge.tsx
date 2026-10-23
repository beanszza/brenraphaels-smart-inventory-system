import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-[3px] text-xs font-medium transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:opacity-80",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-badge-purple text-badge-purple-foreground",
        secondary:
          "border-transparent bg-badge-neutral text-badge-neutral-foreground",
        destructive:
          "border-transparent bg-badge-destructive text-badge-destructive-foreground",
        outline: "border-border bg-badge-info text-badge-info-foreground",
        success:
          "border-transparent bg-badge-success text-badge-success-foreground",
        warning:
          "border-transparent bg-badge-warning text-badge-warning-foreground",
        info:
          "border-transparent bg-badge-info text-badge-info-foreground",
        purple:
          "border-transparent bg-badge-purple text-badge-purple-foreground",
        indigo:
          "border-transparent bg-badge-indigo text-badge-indigo-foreground",
        teal: "border-transparent bg-badge-teal text-badge-teal-foreground",
        orange: "border-transparent bg-badge-orange text-badge-orange-foreground",
        notification:
          "border-transparent bg-badge-notification text-badge-notification-foreground shadow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
